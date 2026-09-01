/**
 * The single mocked operating scenario behind the prototype.
 *
 * EVERY NUMBER IN THIS FILE IS FABRICATED. No Meridian data was provided, and
 * none is used. These values exist so the guardrail engine has something real
 * to evaluate against. They are deliberately thin: one product, one distribution
 * centre, one week. Because every field on the buyer proposal is editable, this
 * one scenario is enough to trigger every guardrail outcome the engine supports.
 *
 * Grain of the position data: SKU x location x day.
 * Grain the production model would need: SKU x location x week.
 */
export const scenario = {
  asOf: "2026-07-06",

  product: {
    itemId: "GW-24-500",
    name: "Glacier Water 24 x 500ml",
    unit: "Case",
    abcClass: "C",
    abcNote:
      "Classified C on trailing annual volume. During this heatwave it is one of " +
      "the fastest movers in the region — which is the point: the classification " +
      "is an annual average, and velocity is a property of a SKU in a place at a time."
  },

  location: {
    id: "MN-DC",
    name: "Minnesota Distribution Center",
    site: "MN"
  },

  position: {
    onHandCases: 6200,
    openPurchaseOrders: [
      { poNumber: "PO-118423", cases: 8000, expectedReceipt: "2026-07-14" }
    ]
  },

  demand: {
    baselineDailyCases: 620,
    elevatedDailyCases: 1700,
    elevatedReason: "Retailer-reported heatwave lift, ValueFresh Minnesota stores",
    basis:
      "Illustrative run-rates. Baseline is the normal-conditions rate used for " +
      "cover policy; elevated is the current rate used for stockout projection."
  },

  suppliers: {
    "NorthStar Bottling": {
      vendorAccount: "NSB-1042",
      approved: true,
      minimumOrderCases: 1200,
      standardLeadTimeDays: 7,
      expeditedLeadTimeDays: 3
    },
    "Great Lakes Beverage Co.": {
      vendorAccount: "GLB-2210",
      approved: true,
      minimumOrderCases: 2400,
      standardLeadTimeDays: 9,
      expeditedLeadTimeDays: 5
    }
  },

  signal: {
    source: "Outlook",
    from: "Elena Ruiz <eruiz@valuefresh.example>",
    retailer: "ValueFresh",
    receivedAt: "2026-07-06T09:14:00",
    reference: "SIG-2026-0706-004"
  },

  /** The buyer's opening position — a starting point, not a system recommendation. */
  defaultProposal: {
    action: "Increase + expedite",
    quantity: 4800,
    requiredDate: "2026-07-11",
    supplier: "NorthStar Bottling",
    rationale:
      "ValueFresh reports Glacier Water is selling materially above plan during the " +
      "Minnesota heatwave. Increase the next receipt and expedite delivery to reduce " +
      "near-term stockout exposure."
  }
};
