import { policy } from "./policy.js";
import { scenario } from "./scenario.js";
import { evaluate, formatCases, formatDate, parseDate, toNumber } from "./guardrails.js";

const state = {
  step: 0,
  forwarded: false,
  overrideReason: "",
  proposal: { ...scenario.defaultProposal }
};

const steps = [
  { short: "Signal", title: "Retailer signal received", app: "Outlook" },
  { short: "Initiate", title: "Account manager initiates workflow", app: "Outlook" },
  { short: "Synopsis", title: "Structured signal reaches purchasing", app: "Teams" },
  { short: "Proposal", title: "Buyer proposes the purchasing action", app: "Teams" },
  { short: "Validate", title: "System checks purchasing guardrails", app: "Teams" },
  { short: "Confirm", title: "Buyer confirms the governed handoff", app: "Teams" },
  { short: "Draft", title: "D365-ready draft is prepared", app: "Dynamics 365" }
];

const VALIDATE_STEP = 4;
const ICONS = { pass: "✓", warn: "!", block: "✕", info: "i" };
const MIN_REASON = 10;
const ACTION_OPTIONS = ["Increase + expedite", "Increase next order", "Expedite current order", "No change"];

const app = document.querySelector("#app");
const journey = document.querySelector("#journey");
const backButton = document.querySelector("#backButton");
const nextButton = document.querySelector("#nextButton");
const resetButton = document.querySelector("#resetButton");
const stepCaption = document.querySelector("#stepCaption");

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));

/** Single source of truth for the current evaluation. Recomputed, never cached. */
function assessment() {
  return evaluate(state.proposal, scenario, policy);
}

function supplierRecord() {
  return scenario.suppliers[state.proposal.supplier];
}

function appWindow(content, label, kind) {
  return `<section class="stage">
    <div class="stage-intro"><div><h2>${steps[state.step].title}</h2><p>${subtitleForStep()}</p></div><span class="app-label ${kind}">${label}</span></div>
    <div class="app-window"><div class="window-bar"><div class="window-dots"><i></i><i></i><i></i></div><span class="tenant-badge">Meridian Beverages · Internal conceptual environment</span></div>${content}</div>
  </section>`;
}

function subtitleForStep() {
  return [
    "A known retailer signal arrives through an existing, familiar channel.",
    "The account manager uses ordinary email behavior to route the signal internally.",
    "The workflow structures the message without separating it from its source evidence.",
    "The buyer owns the judgment; the system organizes the proposal and context.",
    "Every check below is computed from the proposal. Change a field and the outcome changes.",
    "The buyer remains the final decision-maker and creates an auditable outcome.",
    "The confirmed action becomes a prefilled—but explicitly unsubmitted—order draft."
  ][state.step];
}

function outlookShell(content) {
  return `<div class="outlook-layout">
    <aside class="app-rail"><div class="rail-icon active">✉</div><div class="rail-icon">▦</div><div class="rail-icon">✓</div></aside>
    <aside class="mail-list"><div class="mail-list-title">Inbox</div><div class="mail-item active"><strong>Elena Ruiz · ValueFresh</strong><span>Glacier Water demand — Minnesota</span></div><div class="mail-item"><strong>NorthStar Bottling</strong><span>Weekly supplier confirmation</span></div><div class="mail-item"><strong>Planning Operations</strong><span>Monday inventory export available</span></div></aside>
    <article class="mail-pane">${content}</article>
  </div>`;
}

function emailContent(showForward = false) {
  return `<div class="mail-toolbar"><button class="toolbar-button">Reply</button><button class="toolbar-button ${showForward ? "emphasis" : ""}" id="forwardAction">Forward</button><button class="toolbar-button">More</button></div>
    <h2 class="mail-subject">Glacier Water demand — Minnesota stores</h2>
    <div class="sender"><div class="avatar">ER</div><div class="sender-meta"><strong>Elena Ruiz &lt;eruiz@valuefresh.example&gt;</strong><span>To: Marcus Hill · Meridian Beverages · Monday, July 6, 2026 · 9:14 AM</span></div></div>
    <div class="mail-body"><p>Hi Marcus,</p><p>Glacier Water is moving much faster than expected across our Minnesota stores as the heatwave continues. Several locations are already below a week of inventory.</p><div class="mail-callout"><strong>Buyer signal:</strong> Please review whether Meridian can increase and accelerate the next shipment. We need an answer before tomorrow’s replenishment cutoff.</div><p>Thanks,<br/>Elena</p></div>
    ${showForward ? `<div class="forward-card"><div><strong>Forward to internal purchasing workflow</strong><div class="forward-address">purchasing-signals@meridian.example</div></div><button class="primary-button" id="sendForward">Send</button></div>` : ""}`;
}

function teamsShell(content) {
  return `<div class="teams-layout">
    <aside class="teams-rail"><div class="teams-icon"><strong>☰</strong>Activity</div><div class="teams-icon active"><strong>T</strong>Teams</div><div class="teams-icon"><strong>☏</strong>Chat</div></aside>
    <aside class="teams-nav"><h3>Teams</h3><div class="team-name">Supply Planning</div><div class="channel active">Purchasing signals</div><div class="channel">Buyer actions</div><div class="channel">Exceptions</div></aside>
    <section class="teams-content"><div class="channel-header"><strong>Purchasing signals</strong><span class="tenant-badge">Internal · 12 members</span></div><div class="posts">${content}</div></section>
  </div>`;
}

function synopsisCard() {
  return `<div class="post"><div class="avatar">MW</div><div><div class="post-head"><strong>Meridian Purchasing Workflow</strong><span>Automated workflow · just now</span></div>
    <div class="adaptive-card"><div class="card-content"><p class="card-kicker">NEW RETAILER SIGNAL · BUYER REVIEW REQUIRED</p><h3>Glacier Water demand accelerating in Minnesota</h3><p class="summary">ValueFresh reports faster-than-expected sales during the current heatwave and asks Meridian to review increasing and accelerating its next shipment before tomorrow’s replenishment cutoff.</p>
    <div class="facts"><div class="fact"><span>Retailer</span><strong>ValueFresh</strong></div><div class="fact"><span>Product</span><strong>Glacier Water</strong></div><div class="fact"><span>Geography</span><strong>Minnesota</strong></div><div class="fact"><span>Timing</span><strong>Before cutoff</strong></div></div>
    <div class="source-row"><span>Source retained: Outlook email from Elena Ruiz</span><span class="source-link">View original email ↗</span></div></div>
    <div class="card-actions"><button class="secondary-button">Not a purchasing signal</button><button class="primary-button" id="reviewSignal">Review purchasing action</button></div></div>
  </div></div>`;
}

function proposalView() {
  const p = state.proposal;
  const s = supplierRecord();
  const projection = assessment().projection;
  const supplierNames = Object.keys(scenario.suppliers);
  const openCases = scenario.position.openPurchaseOrders.reduce((sum, po) => sum + po.cases, 0);

  return `<div class="proposal-grid"><section class="form-panel"><div class="panel-heading"><h3>Buyer proposal</h3><p>Enter the purchasing action you recommend. The workflow will validate—not make—the decision.</p></div><div class="form-body">
    <div class="form-row">
      <div class="field"><label for="action">Action</label><select id="action">${ACTION_OPTIONS.map(a => `<option ${a === p.action ? "selected" : ""}>${a}</option>`).join("")}</select></div>
      <div class="field"><label for="quantity">Additional quantity (cases)</label><input id="quantity" value="${escapeHtml(p.quantity)}" inputmode="numeric" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="requiredDate">Required date</label><input id="requiredDate" type="date" value="${escapeHtml(p.requiredDate)}" /></div>
      <div class="field"><label for="supplier">Supplier</label><select id="supplier">${supplierNames.map(n => `<option ${n === p.supplier ? "selected" : ""}>${n}</option>`).join("")}</select></div>
    </div>
    <div class="field"><label for="rationale">Buyer rationale</label><textarea id="rationale">${escapeHtml(p.rationale)}</textarea></div>
    <p class="form-hint"><strong>Every field here drives the checks on the next screen.</strong> Try quantity <code>500</code> (blocked — under the supplier minimum), <code>8000</code> (warns on cover, and asks you to record a reason), or action <code>Increase next order</code> (blocked — the required date is not achievable on standard lead time).</p>
  </div></section><aside class="context-panel"><div class="panel-heading"><h3>Available decision context</h3><p>Mocked internal position, assembled around the signal</p></div><div class="panel-body">
    <div class="context-section"><h4>Inventory position · ${scenario.location.name}</h4>
      <div class="context-row"><span>On hand</span><strong>${formatCases(scenario.position.onHandCases)} cases</strong></div>
      <div class="context-row"><span>Open purchase orders</span><strong>${formatCases(openCases)} cases</strong></div>
      <div class="context-row"><span>Next scheduled receipt</span><strong>${formatDate(projection.nextScheduledReceipt)}</strong></div>
      <div class="context-row"><span>Current demand rate</span><strong>${formatCases(projection.elevatedDailyCases)} / day</strong></div>
      <div class="context-row"><span>Projected depletion</span><strong>${formatDate(projection.depletionWithoutAction)}</strong></div>
    </div>
    <div class="context-section"><h4>Supplier context · ${escapeHtml(p.supplier)}</h4>
      <div class="context-row"><span>Approved supplier</span><strong>${s && s.approved ? "Yes" : "No"}</strong></div>
      <div class="context-row"><span>Standard lead time</span><strong>${s ? s.standardLeadTimeDays : "—"} days</strong></div>
      <div class="context-row"><span>Expedited lead time</span><strong>${s ? s.expeditedLeadTimeDays : "—"} days</strong></div>
      <div class="context-row"><span>Minimum order quantity</span><strong>${s ? formatCases(s.minimumOrderCases) : "—"} cases</strong></div>
    </div>
    <div class="context-note"><strong>Illustrative data.</strong> Every figure above is a placeholder in <code>scenario.js</code>. No Meridian data was provided or used. Production access must be validated with Meridian IT.</div>
  </div></aside></div>`;
}

function validationView() {
  const result = assessment();
  const rows = result.checks.map(c => `<div class="check ${c.status}">
      <div class="status-icon ${c.status}">${ICONS[c.status]}</div>
      <strong>${escapeHtml(c.label)}<span class="check-headline">${escapeHtml(c.headline)}</span></strong>
      <p>${escapeHtml(c.detail)}</p>
    </div>`).join("");

  const blockedCount = result.checks.filter(c => c.status === "block").length;
  const passCount = result.checks.filter(c => c.status === "pass").length;

  let banner;
  if (result.blocked) {
    banner = `<div class="readiness blocked"><strong>Cannot prepare a draft</strong>${blockedCount} blocking check${blockedCount === 1 ? "" : "s"} must be resolved. Go back and change the proposal — the workflow will not pass an infeasible order to Dynamics 365.</div>`;
  } else if (!result.producesDraft) {
    banner = `<div class="readiness warning"><strong>No order will be prepared</strong>The proposed action creates no purchase order. The decision and its rationale are recorded, and the workflow closes here.</div>`;
  } else if (result.requiresOverride) {
    banner = `<div class="readiness warning"><strong>Override reason required</strong>${passCount} check${passCount === 1 ? "" : "s"} passed. ${escapeHtml(result.overrideLabels.join(" and "))} raised a warning the buyer may accept, with a recorded reason.</div>
      <div class="override"><label for="overrideReason">Reason for proceeding past ${escapeHtml(result.overrideLabels.join(" and "))}</label>
      <textarea id="overrideReason" placeholder="Recorded in the audit trail and carried onto the draft.">${escapeHtml(state.overrideReason)}</textarea>
      <span class="override-hint" id="overrideHint"></span></div>`;
  } else {
    banner = `<div class="readiness"><strong>Ready for buyer confirmation</strong>${passCount} checks passed. The only remaining requirement is the buyer's own confirmation.</div>`;
  }

  return `<div class="validation-wrap"><section class="validation-panel"><div class="panel-heading"><h3>Guardrail validation</h3><p>Computed from the proposal against <code>policy.js</code> · thresholds are placeholders</p></div><div class="checklist">${rows}</div>${banner}
  </section><aside class="confirmation-panel"><div class="panel-heading"><h3>Proposed order</h3><p>Buyer-owned fields carried forward unchanged</p></div><div class="panel-body order-summary">${summaryRows()}</div></aside></div>`;
}

function summaryRows() {
  const p = state.proposal;
  const behaviour = assessment().behaviour;
  const qtyRow = behaviour.createsOrder
    ? `<div class="summary-row"><span>Quantity</span><strong>${formatCases(toNumber(p.quantity))} cases</strong></div>`
    : `<div class="summary-row"><span>Quantity</span><strong>No new volume</strong></div>`;
  return `<div class="summary-row"><span>Product</span><strong>${scenario.product.name}</strong></div>
    <div class="summary-row"><span>Action</span><strong>${escapeHtml(p.action)}</strong></div>
    ${qtyRow}
    <div class="summary-row"><span>Required date</span><strong>${formatDate(parseDate(p.requiredDate))}</strong></div>
    <div class="summary-row"><span>Supplier</span><strong>${escapeHtml(p.supplier)}</strong></div>
    <div class="summary-row"><span>Destination</span><strong>${scenario.location.name}</strong></div>`;
}

function confirmationView() {
  const result = assessment();
  const outcomes = result.checks.map(c => `<div class="audit-line ${c.status}"><span>${ICONS[c.status]}</span>${escapeHtml(c.label)} — ${escapeHtml(c.headline)}</div>`).join("");
  const override = state.overrideReason.trim()
    ? `<div class="audit-override"><strong>Buyer override recorded</strong>${escapeHtml(state.overrideReason.trim())}</div>`
    : "";

  return `<div class="proposal-grid"><section class="confirmation-panel"><div class="confirm-banner"><strong>All required information is ready</strong>The proposal can now be confirmed or returned for modification.</div><div class="panel-heading"><h3>Buyer confirmation</h3><p>Your confirmation authorizes preparation of an unsaved D365 purchase-order draft.</p></div><div class="panel-body order-summary">${summaryRows()}
    <div class="audit"><strong>Audit record prepared</strong>
      <div class="audit-line pass"><span>✓</span>Source email retained · ${escapeHtml(scenario.signal.reference)}</div>
      <div class="audit-line pass"><span>✓</span>Buyer proposal captured</div>
      ${outcomes}
      ${override}
    </div></div></section>
  <aside class="context-panel"><div class="panel-heading"><h3>Decision ownership</h3><p>What the buyer owns versus what the workflow supports</p></div><div class="panel-body"><div class="context-section"><h4>Buyer owns</h4><div class="context-row"><span>Interpret context</span><strong>✓</strong></div><div class="context-row"><span>Propose order action</span><strong>✓</strong></div><div class="context-row"><span>Modify or confirm</span><strong>✓</strong></div></div><div class="context-section"><h4>Workflow supports</h4><div class="context-row"><span>Structure the signal</span><strong>✓</strong></div><div class="context-row"><span>Apply guardrails</span><strong>✓</strong></div><div class="context-row"><span>Prepare handoff + audit</span><strong>✓</strong></div></div><div class="context-note">The workflow never decides and never submits. It shortens the distance between a decision the buyer has already made and the system that executes it.</div></div></aside></div>`;
}

function dynamicsView() {
  const p = state.proposal;
  const result = assessment();
  const s = supplierRecord();
  const existing = scenario.position.openPurchaseOrders[0];
  const isChange = result.behaviour.pullsIn;
  const quantity = isChange ? existing.cases : toNumber(p.quantity);
  const heading = isChange ? `Change purchase order ${existing.poNumber}` : "New purchase order";
  const override = state.overrideReason.trim()
    ? `<section class="record-section"><h3>Buyer override note</h3><div class="record-value wide">${escapeHtml(state.overrideReason.trim())}</div></section>`
    : "";

  return `<div class="dynamics-layout"><aside class="dynamics-nav"><div class="dynamics-brand"><span>◈</span> Dynamics 365</div><div class="dynamics-nav-item">Home</div><div class="dynamics-nav-item">Procurement</div><div class="dynamics-nav-item active">Purchase orders</div><div class="dynamics-nav-item">Vendors</div><div class="dynamics-nav-item">Inventory</div></aside><section class="dynamics-main">
    <div class="dynamics-command"><button class="command disabled">Save</button><button class="command disabled">Submit</button><button class="command">Validate</button><button class="command">More options</button></div>
    <div class="record"><div class="record-heading"><div><h2>${heading}</h2><p>Prefilled from confirmed Meridian purchasing action</p></div><span class="draft-badge">Prefilled draft—not submitted</span></div>
    <section class="record-section"><h3>Purchase order header</h3><div class="record-fields"><div class="record-field"><label>Vendor account</label><div class="record-value">${s ? s.vendorAccount : "—"} · ${escapeHtml(p.supplier)}</div></div><div class="record-field"><label>Delivery location</label><div class="record-value">${scenario.location.id} · ${scenario.location.name}</div></div><div class="record-field"><label>Requested receipt date</label><div class="record-value">${formatDate(parseDate(p.requiredDate))}</div></div><div class="record-field"><label>Buyer group</label><div class="record-value">BEV-WATER</div></div><div class="record-field"><label>Order status</label><div class="record-value">Draft</div></div><div class="record-field"><label>Workflow reference</label><div class="record-value">${escapeHtml(scenario.signal.reference)}</div></div></div></section>
    <section class="record-section"><h3>Purchase order lines</h3><table class="line-table"><thead><tr><th>Item</th><th>Description</th><th>Quantity</th><th>Unit</th><th>Site</th><th>Warehouse</th><th>Delivery mode</th></tr></thead><tbody><tr><td>${scenario.product.itemId}</td><td>${scenario.product.name}</td><td>${formatCases(quantity)}</td><td>${scenario.product.unit}</td><td>${scenario.location.site}</td><td>${scenario.location.id}</td><td>${result.behaviour.expedite ? "Expedited" : "Standard"}</td></tr></tbody></table></section>
    ${override}
    <div class="not-submitted"><strong>ⓘ</strong><div><strong>End of conceptual Phase 1 flow.</strong><br/>This screen demonstrates the intended D365-ready handoff. Nothing has been saved, submitted or written to Dynamics 365.</div></div>
    </div></section></div>`;
}

function saveProposal() {
  const action = document.querySelector("#action");
  if (!action) return;
  state.proposal = {
    action: action.value,
    quantity: document.querySelector("#quantity").value,
    requiredDate: document.querySelector("#requiredDate").value,
    supplier: document.querySelector("#supplier").value,
    rationale: document.querySelector("#rationale").value
  };
  state.overrideReason = "";
}

/** True when the buyer is allowed to move forward from the current step. */
function canAdvance() {
  if (state.step !== VALIDATE_STEP) return true;
  const result = assessment();
  if (result.blocked || !result.producesDraft) return false;
  if (result.requiresOverride && state.overrideReason.trim().length < MIN_REASON) return false;
  return true;
}

function advanceCaption() {
  const result = assessment();
  if (result.blocked) return "Resolve the blocking checks to continue";
  if (!result.producesDraft) return "No draft to prepare for this action";
  if (result.requiresOverride && state.overrideReason.trim().length < MIN_REASON) {
    return `Record a reason (${MIN_REASON}+ characters) to continue`;
  }
  return steps[state.step].title;
}

function updateFooter() {
  nextButton.disabled = state.step === VALIDATE_STEP && !canAdvance();
  nextButton.textContent = ["Open forwarding action", "Send and open Teams", "Review purchasing action", "Validate proposal", "Continue to confirmation", "Confirm and prepare draft", "Restart demo"][state.step];
  stepCaption.innerHTML = `<strong>Step ${state.step + 1} of ${steps.length}</strong>${escapeHtml(state.step === VALIDATE_STEP ? advanceCaption() : steps[state.step].title)}`;

  const hint = document.querySelector("#overrideHint");
  if (hint) {
    const remaining = MIN_REASON - state.overrideReason.trim().length;
    hint.textContent = remaining > 0 ? `${remaining} more character${remaining === 1 ? "" : "s"} required` : "Reason recorded — it will appear on the audit record and the draft.";
    hint.className = `override-hint ${remaining > 0 ? "" : "ok"}`;
  }
  renderJourney();
}

function renderStep() {
  const renderers = [
    () => appWindow(outlookShell(emailContent(false)), "Outlook", "outlook"),
    () => appWindow(outlookShell(emailContent(true)), "Outlook", "outlook"),
    () => appWindow(teamsShell(synopsisCard()), "Microsoft Teams", "teams"),
    () => appWindow(teamsShell(proposalView()), "Microsoft Teams", "teams"),
    () => appWindow(teamsShell(validationView()), "Microsoft Teams", "teams"),
    () => appWindow(teamsShell(confirmationView()), "Microsoft Teams", "teams"),
    () => appWindow(dynamicsView(), "Dynamics 365", "dynamics")
  ];
  app.innerHTML = renderers[state.step]();
  backButton.disabled = state.step === 0;

  document.querySelector("#forwardAction")?.addEventListener("click", () => goToStep(1));
  document.querySelector("#sendForward")?.addEventListener("click", () => { state.forwarded = true; goToStep(2); });
  document.querySelector("#reviewSignal")?.addEventListener("click", () => goToStep(3));
  document.querySelector("#overrideReason")?.addEventListener("input", (event) => {
    state.overrideReason = event.target.value;
    updateFooter();
  });

  updateFooter();
}

function renderJourney() {
  const furthest = canAdvance() ? Math.max(state.step + 1, 1) : state.step;
  journey.innerHTML = steps.map((step, index) => `<button class="journey-step ${index === state.step ? "active" : ""} ${index < state.step ? "complete" : ""}" data-step="${index}" ${index > furthest ? "disabled" : ""}><span class="journey-index">0${index + 1} · ${step.app}</span>${step.short}</button>`).join("");
  journey.querySelectorAll("button:not([disabled])").forEach(button => button.addEventListener("click", () => goToStep(Number(button.dataset.step))));
}

function goToStep(nextStep) {
  if (state.step === 3) saveProposal();
  if (nextStep > state.step && !canAdvance()) return;
  state.step = Math.max(0, Math.min(steps.length - 1, nextStep));
  renderStep();
  const stepHeading = document.querySelector(".stage-intro h2");
  stepHeading?.setAttribute("tabindex", "-1");
  stepHeading?.focus({ preventScroll: true });
  document.querySelector(".stage")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function reset() {
  state.step = 0;
  state.forwarded = false;
  state.overrideReason = "";
  state.proposal = { ...scenario.defaultProposal };
  renderStep();
}

/* ---- Intro overlay ------------------------------------------------------
   Shown on every open, because this file gets emailed and forwarded and the
   next person to open it has no context. Dismissible three ways; reopenable
   from the ? in the header. */
const introBackdrop = document.querySelector("#introBackdrop");
const introStart = document.querySelector("#introStart");
const helpButton = document.querySelector("#helpButton");
let introOpener = null;

function openIntro(opener) {
  if (!introBackdrop) return;
  introOpener = opener || null;
  introBackdrop.hidden = false;
  introStart?.focus({ preventScroll: true });
}

function closeIntro() {
  if (!introBackdrop || introBackdrop.hidden) return;
  introBackdrop.hidden = true;
  (introOpener || nextButton)?.focus({ preventScroll: true });
  introOpener = null;
}

introStart?.addEventListener("click", closeIntro);
helpButton?.addEventListener("click", () => openIntro(helpButton));
introBackdrop?.addEventListener("click", (event) => {
  if (event.target === introBackdrop) closeIntro();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeIntro();
});

backButton.addEventListener("click", () => goToStep(state.step - 1));
nextButton.addEventListener("click", () => state.step === steps.length - 1 ? reset() : goToStep(state.step + 1));
resetButton.addEventListener("click", reset);

renderStep();
openIntro();
