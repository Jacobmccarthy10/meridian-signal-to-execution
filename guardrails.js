/**
 * Purchasing guardrail engine.
 *
 * Pure functions. No DOM, no network, no imports — the same module runs in the
 * browser and under `node test.mjs`. It takes a buyer proposal, an inventory
 * position and a policy, and returns what passed, what failed, and why.
 *
 * It does NOT recommend a quantity. The buyer proposes; this validates.
 */

const DAY_MS = 86400000;

export function parseDate(iso) {
  return new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function daysBetween(from, to) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) return "—";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function formatCases(value) {
  return Math.round(value).toLocaleString("en-US");
}

export function toNumber(value) {
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * What each buyer action means mechanically.
 * `createsOrder`  — a new PO line, so quantity and MOQ apply.
 * `pullsIn`       — moves the existing open PO earlier instead of adding volume.
 * `expedite`      — use the supplier's expedited lead time rather than standard.
 */
export const ACTIONS = {
  "Increase + expedite": { createsOrder: true, pullsIn: false, expedite: true },
  "Increase next order": { createsOrder: true, pullsIn: false, expedite: false },
  "Expedite current order": { createsOrder: false, pullsIn: true, expedite: true },
  "No change": { createsOrder: false, pullsIn: false, expedite: false }
};

/** Day-by-day inventory projection. Returns the days on which stock runs out. */
function project(scenario, receipts, dailyDemand, horizonDays) {
  const start = parseDate(scenario.asOf);
  let stock = scenario.position.onHandCases;
  let firstDepletion = null;
  let exposureDays = 0;

  for (let i = 1; i <= horizonDays; i++) {
    const day = addDays(start, i);
    for (const receipt of receipts) {
      if (receipt.date.getTime() === day.getTime()) stock += receipt.cases;
    }
    stock -= dailyDemand;
    if (stock < 0) {
      if (!firstDepletion) firstDepletion = day;
      exposureDays += 1;
      stock = 0;
    }
  }
  return { firstDepletion, exposureDays };
}

function baselineReceipts(scenario) {
  return scenario.position.openPurchaseOrders.map(po => ({
    date: parseDate(po.expectedReceipt),
    cases: po.cases,
    poNumber: po.poNumber
  }));
}

function proposedReceipts(scenario, behaviour, quantity, requiredDate) {
  const receipts = baselineReceipts(scenario);
  if (behaviour.createsOrder && quantity > 0 && requiredDate) {
    receipts.push({ date: requiredDate, cases: quantity, poNumber: "NEW" });
  }
  if (behaviour.pullsIn && receipts.length && requiredDate) {
    receipts[0] = { ...receipts[0], date: requiredDate };
  }
  return receipts;
}

/**
 * Evaluate a buyer proposal against the position and the policy.
 *
 * @returns {{
 *   checks: Array<{id,label,status,headline,detail,severity}>,
 *   blocked: boolean,
 *   requiresOverride: boolean,
 *   overrideLabels: string[],
 *   producesDraft: boolean,
 *   projection: object
 * }}
 */
export function evaluate(proposal, scenario, policy) {
  const severityOf = id => (policy.rules.find(r => r.id === id) || {}).severity || "warn";
  const labelOf = id => (policy.rules.find(r => r.id === id) || {}).label || id;

  const behaviour = ACTIONS[proposal.action] || ACTIONS["No change"];
  const supplier = scenario.suppliers[proposal.supplier];
  const quantity = toNumber(proposal.quantity);
  const requiredDate = proposal.requiredDate ? parseDate(proposal.requiredDate) : null;
  const validDate = requiredDate && !Number.isNaN(requiredDate.getTime());

  const start = parseDate(scenario.asOf);
  const elevated = scenario.demand.elevatedDailyCases;
  const baseline = scenario.demand.baselineDailyCases;
  const horizon = policy.horizonDays;

  // Stockout exposure is assessed over the bridge to the next scheduled receipt,
  // not the full planning horizon. Beyond that receipt, later POs that this mock
  // does not carry would take over, so projecting further would invent exposure.
  const scheduled = baselineReceipts(scenario);
  const lastScheduledDays = scheduled.length
    ? Math.max(...scheduled.map(r => daysBetween(start, r.date)))
    : 0;
  const requiredDays = validDate ? daysBetween(start, requiredDate) : 0;
  const bridge = Math.max(lastScheduledDays, requiredDays, policy.shortfallMinimumDays || 7);

  const before = project(scenario, scheduled, elevated, bridge);
  const after = project(
    scenario,
    proposedReceipts(scenario, behaviour, quantity, validDate ? requiredDate : null),
    elevated,
    bridge
  );

  const checks = [];

  // 1 — Is the shortfall real, and does this action actually reduce it?
  const nextReceipt = baselineReceipts(scenario)
    .slice()
    .sort((a, b) => a.date - b.date)[0];
  if (before.exposureDays === 0) {
    checks.push({
      id: "shortfall", label: labelOf("shortfall"), severity: severityOf("shortfall"), status: "warn",
      headline: "No shortfall projected",
      detail: `At the current elevated rate of ${formatCases(elevated)} cases/day, on-hand and open POs cover the next ${horizon} days. An increase may not be needed.`
    });
  } else if (proposal.action === "No change") {
    checks.push({
      id: "shortfall", label: labelOf("shortfall"), severity: severityOf("shortfall"), status: "warn",
      headline: `${before.exposureDays} days of exposure, no action proposed`,
      detail: `Stock depletes ${formatDate(before.firstDepletion)}; the next scheduled receipt is ${nextReceipt ? formatDate(nextReceipt.date) : "not scheduled"}. Proceeding accepts that exposure.`
    });
  } else if (after.exposureDays < before.exposureDays) {
    const closed = after.exposureDays === 0;
    checks.push({
      id: "shortfall", label: labelOf("shortfall"), severity: severityOf("shortfall"), status: "pass",
      headline: closed
        ? "Projected exposure fully closed"
        : `Exposure reduced from ${before.exposureDays} days to ${after.exposureDays}`,
      detail: closed
        ? `Without action, stock depletes ${formatDate(before.firstDepletion)} and stays out for ${before.exposureDays} days before ${nextReceipt ? formatDate(nextReceipt.date) : "the next receipt"}. This action removes the gap entirely.`
        : `Without action, stock depletes ${formatDate(before.firstDepletion)} and stays out for ${before.exposureDays} days. This action narrows that to ${after.exposureDays}, but does not close it — an earlier required date or a larger quantity would.`
    });
  } else {
    checks.push({
      id: "shortfall", label: labelOf("shortfall"), severity: severityOf("shortfall"), status: "warn",
      headline: "Action does not reduce exposure",
      detail: `${before.exposureDays} days of projected exposure remain unchanged. Check the required date — inventory arriving after ${formatDate(before.firstDepletion)} cannot prevent the stockout.`
    });
  }

  // 2 — Supplier approval and minimum order quantity.
  if (!behaviour.createsOrder) {
    checks.push({
      id: "moq", label: labelOf("moq"), severity: severityOf("moq"), status: "info",
      headline: "Not applicable",
      detail: "This action does not create a new order quantity, so no minimum applies."
    });
  } else if (!supplier) {
    checks.push({
      id: "moq", label: labelOf("moq"), severity: severityOf("moq"), status: "block",
      headline: "Unknown supplier",
      detail: `${proposal.supplier || "No supplier"} is not in the approved supplier list.`
    });
  } else if (!supplier.approved) {
    checks.push({
      id: "moq", label: labelOf("moq"), severity: severityOf("moq"), status: "block",
      headline: "Supplier not approved",
      detail: `${proposal.supplier} is not an approved supplier for this item.`
    });
  } else if (quantity < supplier.minimumOrderCases) {
    checks.push({
      id: "moq", label: labelOf("moq"), severity: severityOf("moq"), status: "block",
      headline: `Below ${proposal.supplier} minimum`,
      detail: `${formatCases(quantity)} cases is under the ${formatCases(supplier.minimumOrderCases)}-case minimum. Raise the quantity by ${formatCases(supplier.minimumOrderCases - quantity)} cases or change supplier.`
    });
  } else {
    checks.push({
      id: "moq", label: labelOf("moq"), severity: severityOf("moq"), status: "pass",
      headline: "Approved supplier, minimum cleared",
      detail: `${proposal.supplier} is approved and ${formatCases(quantity)} cases clears the ${formatCases(supplier.minimumOrderCases)}-case minimum.`
    });
  }

  // 3 — Can the supplier physically make the required date?
  if (proposal.action === "No change") {
    checks.push({
      id: "leadTime", label: labelOf("leadTime"), severity: severityOf("leadTime"), status: "info",
      headline: "Not applicable",
      detail: "No delivery is being requested."
    });
  } else if (!supplier || !validDate) {
    checks.push({
      id: "leadTime", label: labelOf("leadTime"), severity: severityOf("leadTime"), status: "block",
      headline: "Cannot be evaluated",
      detail: "A valid supplier and required date are needed to check feasibility."
    });
  } else {
    const leadDays = behaviour.expedite ? supplier.expeditedLeadTimeDays : supplier.standardLeadTimeDays;
    const earliest = addDays(start, leadDays);
    const mode = behaviour.expedite ? "expedited" : "standard";
    if (requiredDate < earliest) {
      const expeditedEarliest = addDays(start, supplier.expeditedLeadTimeDays);
      const couldExpedite = !behaviour.expedite && requiredDate >= expeditedEarliest;
      checks.push({
        id: "leadTime", label: labelOf("leadTime"), severity: severityOf("leadTime"), status: "block",
        headline: `Not achievable on ${mode} lead time`,
        detail: `${proposal.supplier} needs ${leadDays} days ${mode}, so the earliest possible receipt is ${formatDate(earliest)} — after the required ${formatDate(requiredDate)}.` +
          (couldExpedite
            ? ` Expediting would bring this to ${formatDate(expeditedEarliest)} and make the date achievable.`
            : " Move the required date out, or select a faster supplier.")
      });
    } else {
      const slack = daysBetween(earliest, requiredDate);
      checks.push({
        id: "leadTime", label: labelOf("leadTime"), severity: severityOf("leadTime"), status: "pass",
        headline: `Achievable on ${mode} lead time`,
        detail: `${proposal.supplier} can deliver by ${formatDate(earliest)} using the ${leadDays}-day ${mode} lead time, ${slack === 0 ? "exactly meeting" : `${slack} day${slack === 1 ? "" : "s"} ahead of`} the required ${formatDate(requiredDate)}.`
      });
    }
  }

  // 4 — Resulting cover, measured against baseline demand, not the spike.
  const openWithinHorizon = baselineReceipts(scenario)
    .filter(r => daysBetween(start, r.date) <= horizon)
    .reduce((sum, r) => sum + r.cases, 0);
  const addedCases = behaviour.createsOrder ? quantity : 0;
  const totalSupply = scenario.position.onHandCases + openWithinHorizon + addedCases;
  const baselineWeekly = baseline * 7;
  const coverWeeks = baselineWeekly > 0 ? totalSupply / baselineWeekly : 0;
  const coverText = `${coverWeeks.toFixed(1)} weeks`;
  const bounds = `policy range ${policy.cover.minWeeks}–${policy.cover.maxWeeks} weeks`;

  if (coverWeeks > policy.cover.maxWeeks) {
    const excess = Math.round((coverWeeks - policy.cover.maxWeeks) * baselineWeekly);
    checks.push({
      id: "cover", label: labelOf("cover"), severity: severityOf("cover"), status: "warn",
      headline: `${coverText} of cover exceeds the ceiling`,
      detail: `Once demand returns to the ${formatCases(baseline)} cases/day baseline, this position carries ${coverText} against a ${policy.cover.maxWeeks}-week ceiling — roughly ${formatCases(excess)} cases of surplus. This is the mechanism behind excess inventory on slow movers. Proceed only with a recorded reason.`
    });
  } else if (coverWeeks < policy.cover.minWeeks) {
    checks.push({
      id: "cover", label: labelOf("cover"), severity: severityOf("cover"), status: "warn",
      headline: `${coverText} of cover is below the floor`,
      detail: `Resulting cover sits under the ${policy.cover.minWeeks}-week floor (${bounds}), leaving no buffer for further demand movement.`
    });
  } else {
    checks.push({
      id: "cover", label: labelOf("cover"), severity: severityOf("cover"), status: "pass",
      headline: `${coverText} of cover, within policy`,
      detail: `${formatCases(totalSupply)} cases of total supply against a ${formatCases(baselineWeekly)} cases/week baseline sits inside the ${bounds}.`
    });
  }

  // 5 — Stated for transparency. Never gates, never auto-approves.
  checks.push({
    id: "approval", label: labelOf("approval"), severity: severityOf("approval"), status: "info",
    headline: "Buyer confirmation required",
    detail: "Nothing is prepared for Dynamics 365 without an explicit buyer confirmation, and nothing is ever submitted automatically."
  });

  const blocked = checks.some(c => c.status === "block");
  const warnings = checks.filter(c => c.status === "warn");

  return {
    checks,
    blocked,
    requiresOverride: warnings.length > 0,
    overrideLabels: warnings.map(c => c.label),
    producesDraft: behaviour.createsOrder || behaviour.pullsIn,
    behaviour,
    projection: {
      asOf: start,
      elevatedDailyCases: elevated,
      baselineDailyCases: baseline,
      depletionWithoutAction: before.firstDepletion,
      exposureDaysWithoutAction: before.exposureDays,
      exposureDaysWithAction: after.exposureDays,
      nextScheduledReceipt: nextReceipt ? nextReceipt.date : null,
      nextScheduledReceiptPo: nextReceipt ? nextReceipt.poNumber : null,
      nextScheduledReceiptCases: nextReceipt ? nextReceipt.cases : 0,
      totalSupplyCases: totalSupply,
      coverWeeks
    }
  };
}
