/**
 * Purchasing guardrail policy.
 *
 * EVERY VALUE IN THIS FILE IS A PLACEHOLDER.
 *
 * These are not Meridian's rules. They are illustrative stand-ins that let the
 * guardrail engine run end to end. The engine is the deliverable; these numbers
 * are configuration, and week one with a buyer and the Demand/Supply Planning
 * owner replaces them. Nothing in the evaluation logic changes when they do.
 *
 * Severity decides what a failed check does:
 *   "block" — the D365 draft cannot be prepared until the proposal changes.
 *   "warn"  — the buyer may proceed, but must record a reason, which is
 *             carried into the audit record.
 *   "info"  — stated for transparency; never gates anything.
 */
export const policy = {
  version: "placeholder-0.1",
  owner: "Unassigned — to be owned by Demand/Supply Planning",
  replaces: "Stale D365 min/max thresholds, which today encode multi-year-old volumes",

  horizonDays: 45,
  shortfallMinimumDays: 7,

  cover: {
    minWeeks: 1.5,
    maxWeeks: 5.0,
    measuredAgainst: "baseline",
    note:
      "Cover is deliberately measured against baseline demand, not the elevated " +
      "heatwave rate. Sizing buffers on peak demand is how blanket safety-stock " +
      "increases turn into excess inventory once demand normalises."
  },

  rules: [
    {
      id: "shortfall",
      label: "Inventory + open POs",
      severity: "warn",
      question: "Is there a real projected shortfall, and does this action reduce it?"
    },
    {
      id: "moq",
      label: "Supplier + MOQ",
      severity: "block",
      question: "Is the supplier approved and does the quantity clear their minimum?"
    },
    {
      id: "leadTime",
      label: "Lead time",
      severity: "block",
      question: "Can the supplier physically deliver by the required date?"
    },
    {
      id: "cover",
      label: "Resulting cover",
      severity: "warn",
      question: "Does the resulting position stay inside the cover policy?"
    },
    {
      id: "approval",
      label: "Approval requirement",
      severity: "info",
      question: "Who has to say yes before anything reaches D365?"
    }
  ]
};
