# Meridian — Signal to Execution

A working click-through prototype of one purchasing decision moving from a retailer
signal to a Dynamics 365 purchase-order draft, without the buyer leaving the tools
they already use.

**Outlook** → **Teams** → buyer proposal → **computed guardrail validation** → buyer
confirmation → **unsaved D365 draft**.

---

## Open it

**Double-click `Meridian-Signal-to-Execution.html`.**

One self-contained file. No install, no server, no internet connection, nothing to
configure. It runs entirely in the browser and talks to nothing.

---

## What this actually demonstrates

The point is not the screens. It is that **the guardrails compute**.

Every check on the validation screen is evaluated from the buyer's proposal against a
policy file. Change the proposal and the outcome changes — including failing. The
prototype will refuse to prepare a draft for an order that cannot physically happen.

Three severities, taken from `policy.js` rather than hardcoded:

| | Meaning |
|---|---|
| **Block** | The draft cannot be prepared. Supplier minimums and lead-time feasibility. |
| **Warn** | The buyer may proceed, but must record a reason, which is carried into the audit record and onto the draft. Cover-policy breaches. |
| **Info** | Stated for transparency, never gates anything. Approval requirement. |

### Try breaking it

On the **Buyer proposal** step, make one change, then continue:

| Change | What happens |
|---|---|
| Quantity → `500` | **Blocked.** Below the NorthStar 1,200-case minimum. It tells you to add 700 cases. |
| Action → `Increase next order` | **Blocked.** Standard lead time is 7 days; the earliest possible receipt lands after the required date. Expediting is the only way to make it. |
| Quantity → `8000` | **Warns.** 5.1 weeks of cover against a 5-week ceiling. You must type a reason before you can continue — and that reason appears on the D365 draft. |
| Supplier → `Great Lakes`, quantity `1500` | **Blocked.** Different supplier, different minimum. |
| Required date → `2026-07-09`, quantity → `6000` | **All clear**, and projected stockout exposure drops to zero. |

That last row is the interesting one. The default proposal — the one a buyer would
plausibly type — reduces exposure from four days to two but does not close it. The
tool says so, in those words, rather than showing a green tick.

---

## What is real and what is not

**Real:** the guardrail engine, the inventory projection, the lead-time and MOQ
arithmetic, the cover calculation, the block/warn/override behaviour, the audit record,
and the fact that nothing is ever auto-submitted.

**Mocked:** all data. Meridian provided none, and none was used. One product, one
distribution centre, one week, in `scenario.js`. All thresholds in `policy.js`.

Every fabricated number is listed in **[ASSUMPTIONS.md](ASSUMPTIONS.md)**, along with the
data model the production version would need and what week one replaces.

**Not built:** the signal-parsing step is a scripted transition, not a language model.
Nothing connects to Outlook, Teams, Databricks, or Dynamics 365. How it would connect —
and how prompts and data stay inside the Meridian tenant — is in
**[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## Why it deliberately does not recommend a quantity

The buyer proposes. The system validates. That split is the whole design.

Meridian's existing min/max automation is trusted because it is transparent, boring, and
scoped where it cannot hurt anyone. This follows the same pattern one level up: it does
not touch the judgment, it removes the eleven days between the judgment and the purchase
order.

---

## Working on the source

```bash
npm run dev
```

Then open `http://localhost:4173`.

```bash
npm test
```

40 checks. Most of them exercise the guardrail engine directly — the happy path, each
blocking condition, the override tier, and the case where the exposure closes completely.

```bash
npm run build
```

Writes `dist/` and regenerates `Meridian-Signal-to-Execution.html`.

### Repo map

| File | |
|---|---|
| `guardrails.js` | The engine. Pure functions, no DOM, no network. Runs in the browser and under Node. |
| `policy.js` | Thresholds and rule severities. **All placeholders.** |
| `scenario.js` | The one mocked operating position. **All fabricated.** |
| `app.js` | The click-through UI. |
| `test.mjs` | Unit tests for the engine, plus shell checks. |
| `build.mjs` | Builds `dist/` and inlines everything into the standalone file. |
| `Meridian-Signal-to-Execution.html` | **Generated.** Edit the sources, not this. |

---

*Illustrative prototype. No Meridian data was provided or used. Nothing in it connects to
a live system.*
