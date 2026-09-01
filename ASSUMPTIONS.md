# Assumptions, placeholders, and the data model

No Meridian data was provided for this exercise, and none was used. Everything the
prototype evaluates is fabricated. This file lists all of it in one place, so nothing has
to be taken on trust and nothing is buried in the code.

The fabricated values are configuration. The engine that consumes them is the deliverable.
Replacing every number below changes no logic.

---

## 1. The data model

### Grain

| Entity | Grain | In the prototype |
|---|---|---|
| Inventory position | **SKU × location × day** | One row: Glacier Water × MN-DC × 2026-07-06 |
| Demand rate | **SKU × location × day** | Two rates: baseline and current-elevated |
| Open purchase order | PO line × expected receipt date | One: PO-118423 |
| Supplier terms | supplier × item | Two suppliers |
| Signal | one event | One retailer email |
| Proposal | one buyer decision | Editable |
| Audit record | one per confirmed decision | Assembled at confirmation |

The production fact table would sit at **SKU × location × week**. That grain matters more
than any threshold in this repo, and it is the one thing the current A/B/C classification
cannot express: it assigns a single annual badge to a SKU, when velocity is a property of
a SKU **in a place at a time**. Glacier Water is a C-class item on trailing annual volume
and one of the fastest movers in the region during this heatwave. Both statements are
true, and only one of them is in Dynamics 365 today.

### Entities

**Signal** — source system, sender, retailer, product, geography, timing, received-at,
reference id, and a retained pointer to the original evidence.

**Position** — on-hand cases, open purchase orders (number, cases, expected receipt),
baseline daily demand, current daily demand.

**Proposal** — action, quantity, required date, supplier, buyer rationale. Buyer-owned;
the system never writes to these.

**Evaluation** — per rule: id, label, severity, status, headline, detail. Plus the
projection it was derived from.

**Audit record** — signal reference, buyer proposal as submitted, every check outcome,
any override and its recorded reason, the confirmation, and the resulting draft. Written
once, on confirmation.

---

## 2. Every fabricated number

### Position — `scenario.js`

| Field | Value | Note |
|---|---|---|
| As-of date | 2026-07-06 (Monday) | Aligns with the existing Monday planning export |
| On hand, MN-DC | 6,200 cases | |
| Open PO | PO-118423, 8,000 cases, receipt 2026-07-14 | |
| Baseline demand | 620 cases/day | Normal conditions |
| Elevated demand | 1,700 cases/day | Retailer-reported heatwave lift |

These produce a projected depletion of **2026-07-10** and four days of exposure before
the next scheduled receipt. That is computed, not asserted.

### Supplier terms — `scenario.js`

| Supplier | MOQ | Standard | Expedited |
|---|---|---|---|
| NorthStar Bottling | 1,200 cases | 7 days | 3 days |
| Great Lakes Beverage Co. | 2,400 cases | 9 days | 5 days |

### Policy — `policy.js`

| Setting | Value |
|---|---|
| Minimum cover | 1.5 weeks |
| Maximum cover | 5.0 weeks |
| Cover measured against | **baseline** demand, not elevated |
| Planning horizon | 45 days |
| Shortfall assessed over | the bridge to the next scheduled receipt |

**Cover is measured against baseline demand on purpose.** Sizing buffers on peak demand
is the mechanism that turns a blanket safety-stock increase into excess inventory once
demand normalises. Measuring at baseline is what makes the over-order case visible while
the buyer can still change it.

### Rule severities — `policy.js`

| Rule | Severity | Why |
|---|---|---|
| Inventory + open POs | warn | A judgment call, not a hard constraint |
| Supplier + MOQ | **block** | A physical constraint; the supplier will reject it |
| Lead time | **block** | A physical constraint; the date cannot be met |
| Resulting cover | warn | A policy preference the buyer may knowingly accept |
| Approval requirement | info | Stated always; never gates |

---

## 3. What week one replaces

| Placeholder | Replaced by | Who |
|---|---|---|
| All thresholds in `policy.js` | Actual purchasing policy | Demand/Supply Planning owner + an experienced buyer |
| Supplier MOQ and lead times | Supplier master data in D365 | D365 process owner |
| Inventory and open POs | Live position | IT/architecture + D365 process owner |
| Demand rates | Governed demand tables in Databricks | IT/architecture |
| Rule severities | Which rules genuinely block vs. advise | Buyer + planning owner |
| Cover measurement basis | Confirmation that baseline is the right basis | Planning owner |

Two questions the prototype deliberately does not answer, because they are Meridian's to
answer:

1. **Which rules block?** Blocking a buyer is a governance decision. The severities here
   are a proposal, expressed as configuration precisely so they are easy to argue with.
2. **What is the cover ceiling?** 5.0 weeks is invented. The real number is the one the
   CFO's working-capital target implies, and nobody in this exercise has it.

---

## 4. Known limitations

- One SKU, one location, one week. Sufficient to exercise every guardrail outcome,
  insufficient to say anything about portfolio behaviour.
- The signal-parsing step is a scripted transition, not a language model.
- Stockout exposure is projected against a single demand rate held flat. Real demand
  decays as a heatwave breaks; this does not model that.
- No supplier capacity constraint, no transport capacity, no multi-echelon inventory, no
  allocation across DCs.
- The audit record is assembled and displayed, not persisted anywhere.
