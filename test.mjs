import fs from "node:fs/promises";
import { evaluate } from "./guardrails.js";
import { policy } from "./policy.js";
import { scenario } from "./scenario.js";

let failures = 0;
let ran = 0;

function check(name, condition, detail = "") {
  ran += 1;
  if (condition) return;
  failures += 1;
  console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function statusOf(result, id) {
  return (result.checks.find(c => c.id === id) || {}).status;
}

function withProposal(overrides) {
  return evaluate({ ...scenario.defaultProposal, ...overrides }, scenario, policy);
}

console.log("\nGuardrail engine");

// --- The default proposal is the happy path and must stay clean. ---
{
  const r = withProposal({});
  check("default: not blocked", r.blocked === false);
  check("default: no override needed", r.requiresOverride === false, `warnings: ${r.overrideLabels.join(", ")}`);
  check("default: shortfall passes", statusOf(r, "shortfall") === "pass", statusOf(r, "shortfall"));
  check("default: MOQ passes", statusOf(r, "moq") === "pass", statusOf(r, "moq"));
  check("default: lead time passes", statusOf(r, "leadTime") === "pass", statusOf(r, "leadTime"));
  check("default: cover passes", statusOf(r, "cover") === "pass", statusOf(r, "cover"));
  check("default: produces a draft", r.producesDraft === true);
  check("default: reduces exposure",
    r.projection.exposureDaysWithAction < r.projection.exposureDaysWithoutAction,
    `${r.projection.exposureDaysWithoutAction} -> ${r.projection.exposureDaysWithAction}`);
}

// --- Below the supplier minimum must hard-block. ---
{
  const r = withProposal({ quantity: 500 });
  check("qty 500: MOQ blocks", statusOf(r, "moq") === "block");
  check("qty 500: overall blocked", r.blocked === true);
}

// --- Great Lakes has a higher minimum, so the same quantity behaves differently. ---
{
  const r = withProposal({ supplier: "Great Lakes Beverage Co.", quantity: 1500 });
  check("Great Lakes @1500: MOQ blocks", statusOf(r, "moq") === "block");
}

// --- Standard lead time cannot make the required date; expediting can. ---
{
  const standard = withProposal({ action: "Increase next order" });
  check("standard lead time: blocks", statusOf(standard, "leadTime") === "block");
  check("standard lead time: overall blocked", standard.blocked === true);

  const expedited = withProposal({ action: "Increase + expedite" });
  check("expedited lead time: passes", statusOf(expedited, "leadTime") === "pass");
}

// --- An impossible date blocks even when expedited. ---
{
  const r = withProposal({ requiredDate: "2026-07-07" });
  check("required Jul 7: lead time blocks", statusOf(r, "leadTime") === "block");
}

// --- Over-ordering warns on cover rather than blocking, and demands a reason. ---
{
  const r = withProposal({ quantity: 8000 });
  check("qty 8000: cover warns", statusOf(r, "cover") === "warn", statusOf(r, "cover"));
  check("qty 8000: not blocked", r.blocked === false);
  check("qty 8000: override required", r.requiresOverride === true);
  check("qty 8000: cover above ceiling",
    r.projection.coverWeeks > policy.cover.maxWeeks,
    r.projection.coverWeeks.toFixed(2));
}

// --- Doing nothing is allowed, but the accepted exposure is stated. ---
{
  const r = withProposal({ action: "No change" });
  check("no change: shortfall warns", statusOf(r, "shortfall") === "warn");
  check("no change: produces no draft", r.producesDraft === false);
  check("no change: MOQ not applicable", statusOf(r, "moq") === "info");
}

// --- Pulling the existing PO in is a distinct action with no new volume. ---
{
  const r = withProposal({ action: "Expedite current order" });
  check("expedite existing: produces a draft", r.producesDraft === true);
  check("expedite existing: MOQ not applicable", statusOf(r, "moq") === "info");
}

// --- An earlier, larger order closes the gap entirely. This is the discoverable optimum. ---
{
  const r = withProposal({ requiredDate: "2026-07-09", quantity: 6000 });
  check("Jul 9 @6000: exposure fully closed",
    r.projection.exposureDaysWithAction === 0,
    String(r.projection.exposureDaysWithAction));
  check("Jul 9 @6000: nothing blocked", r.blocked === false);
  check("Jul 9 @6000: no override needed", r.requiresOverride === false, r.overrideLabels.join(", "));
}

// --- Severity tiers come from policy, not from hardcoded logic. ---
{
  check("policy: MOQ is a blocking rule",
    policy.rules.find(r => r.id === "moq").severity === "block");
  check("policy: cover is an overridable warning",
    policy.rules.find(r => r.id === "cover").severity === "warn");
}

console.log("\nPrototype shell");

const html = await fs.readFile("index.html", "utf8");
const js = await fs.readFile("app.js", "utf8");
const css = await fs.readFile("styles.css", "utf8");

for (const term of ["Outlook", "Teams", "Buyer proposal", "Guardrail validation", "Dynamics 365", "not submitted"]) {
  check(`flow content present: ${term}`, html.includes(term) || js.includes(term));
}
check("click-through navigation present", js.includes("renderStep") && js.includes("goToStep"));
check("guardrail engine is wired into the UI", js.includes("evaluate("));
check("step navigation focuses content rather than jumping to top",
  js.includes("scrollIntoView") && !js.includes("window.scrollTo({ top: 0"));
check("responsive styles present", css.includes("@media"));
check("blocked state is styled", css.includes(".status-icon.blocked") || css.includes(".check.blocked"));

console.log("");
if (failures > 0) {
  console.error(`${failures} of ${ran} checks failed.\n`);
  process.exit(1);
}
console.log(`All ${ran} checks passed.\n`);
