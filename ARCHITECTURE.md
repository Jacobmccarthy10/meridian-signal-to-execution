# Architecture

How this runs for real, inside Meridian's tenant, on the rails they already have.

The binding constraint is not technical. A previous initiative died in security review
because data left the tenant. So the first design rule is not "what is the best
architecture" — it is **nothing crosses the tenant boundary, and the boundary is drawn
somewhere a CISO can see it.**

---

## The split

```
╔══════════════════════════ MERIDIAN AZURE TENANT ════════════════════════════╗
║                                                                             ║
║   ┌────────────┐      ┌──────────────────────────────────────────────┐      ║
║   │  Outlook   │      │  AZURE DATABRICKS  ·  Unity Catalog          │      ║
║   │  shared    │      │                                              │      ║
║   │  mailbox   │      │  • Signal parsing                            │      ║
║   └─────┬──────┘      │  • Inventory / demand / supplier context     │      ║
║         │             │  • Guardrail evaluation  ← guardrails.js     │      ║
║         │ trigger     │  • Audit log (Delta table)                   │      ║
║         ▼             └───────────────▲──────────────────┬───────────┘      ║
║   ┌──────────────────────────┐        │                  │                  ║
║   │  POWER AUTOMATE          │────────┘ call             │ log              ║
║   │  the courier             │◄──────────────────────────┘                  ║
║   │  (orchestration only —   │                                              ║
║   │   no reasoning, no math) │                                              ║
║   └────┬─────────────────▲───┘                                              ║
║        │ adaptive card   │ buyer response                                   ║
║        ▼                 │                                                  ║
║   ┌────────────────┐     │        ┌──────────────────────────┐              ║
║   │  MICROSOFT     │─────┘        │  DYNAMICS 365            │              ║
║   │  TEAMS         │              │  draft PO — never        │              ║
║   │  the surface   │              │  auto-submitted          │              ║
║   └────────────────┘              └──────────▲───────────────┘              ║
║                                              │ create draft                 ║
║                                              └── from Power Automate        ║
╚═════════════════════════════════════════════════════════════════════════════╝

          No data leaves. No prompt leaves. No new platform. No portal.
```

| Layer | Role | Why it, and not something else |
|---|---|---|
| **Databricks + Unity Catalog** | The brain and the boundary | Already the data platform. Already governed. Model Serving means the prompt and the data never leave the perimeter that Unity Catalog already polices. |
| **Power Automate** | The courier | Already in the tenant, already licensed, already inside IT's DLP policy. No new vendor means no new security review — which is the thing that killed the last attempt. |
| **Teams** | The surface | The buyer is already here. `Post adaptive card and wait for a response` is a first-party human-in-the-loop approval step with run history. |
| **Dynamics 365** | The destination | Where POs already live. The workflow prepares a draft; a human submits it. |


---

## The flow, concretely

| # | Step | Component |
|---|---|---|
| 1 | Retailer email arrives; account manager forwards it to `purchasing-signals@` | Outlook |
| 2 | Mailbox trigger fires | Power Automate — *When a new email arrives (V3)* |
| 3 | Parse the open text into a structured signal: product, geography, direction, urgency | Databricks |
| 4 | Assemble the decision context for that SKU × location | Databricks SQL over Unity Catalog |
| 5 | Post the signal and context to the buyer | Power Automate → Teams *Post adaptive card and wait for a response* |
| 6 | Buyer enters action, quantity, date, supplier, rationale | Teams adaptive card |
| 7 | Evaluate the guardrails against policy | Databricks — the logic in `guardrails.js` |
| 8 | Blocked → return the card with reasons. Warn → require an override reason. Pass → continue | Power Automate branch |
| 9 | Create the purchase order **draft** | Power Automate → *Fin & Ops Apps (Dynamics 365)* connector, OData |
| 10 | Write the audit record: signal, proposal, every check outcome, override, confirmation | Databricks Delta table + Flow run history |

Step 8 is the one that matters. The engine in this repo is step 7, running for real.

---

## Design rules

**Power Automate orchestrates; it does not compute.** Guardrail arithmetic belongs in
Databricks, where it is testable, versioned, and legible. Flow expressions are neither.
This is also why `guardrails.js` is a pure module with no DOM and no network — the same
logic ports to a Databricks job without rewriting it.

**The write-back is always a draft.** There is no configuration that auto-submits a
purchase order. That is not a phase-one caution; it is the trust model. The existing
min/max automation earns its trust by being transparent, boring, and scoped where it
cannot hurt anyone. This copies that posture rather than asking for more.

**Thresholds are configuration, not code.** A buyer can be shown `policy.js` and argue
with it. That is the point.

---

## What has to be validated in week one

Honest list. These are not hand-waves; they are the things that will decide the shape of
the build.

- **D365 F&O purchase-order entities.** The Fin & Ops connector writes via OData, but the
  PO header/line entity model is fiddly. This needs the D365 process owner and a sandbox
  before anyone promises a create-draft call works.
- **Licensing and DLP.** Dataverse, Fin & Ops, HTTP, and Databricks are premium
  connectors, so Power Automate Premium is needed, and IT's DLP policy has to permit that
  connector combination in one flow. A conversation, not a blocker — but have it early.
- **Identity.** Service principal versus on-behalf-of for the D365 write. Affects whether
  the audit trail shows the buyer or the workflow as the actor. It should show the buyer.
- **The Monday export.** Contents, grain, refresh timing, identifiers, quality. The
  guardrails are only as good as the position they read.
- **Environments.** Dev/test/prod Power Platform environments and solution-based
  deployment, so this is promotable rather than hand-built in production.

## What is deliberately not in phase one

Dynamic velocity classification, weather and promotional signals, NIQ market data in the
purchasing loop, and any automated decision. Each is a real opportunity. None of them is
the reason a signal takes eleven days to become a purchase order.
