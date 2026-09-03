# Meridian — Signal to Execution

**https://jacobmccarthy10.github.io/meridian-signal-to-execution/**

A click-through prototype of one purchasing decision. A retailer email lands in Outlook,
becomes a structured signal in Teams, the buyer proposes an action, the system checks it
against purchasing guardrails, the buyer confirms, and a Dynamics 365 purchase order gets
prefilled as a draft. Nothing is ever submitted.

Seven steps, about two minutes.

## The point of it

The guardrails aren't drawn. They compute.

Every check on the validation step is evaluated from whatever the buyer typed, so changing
the proposal changes the result, including failing it. Three worth trying on step 4:

**Quantity `500`** blocks. It's under NorthStar's 1,200-case minimum, and it tells you
you're 700 short.

**Quantity `8000`** warns. Resulting cover comes out at 5.1 weeks against a 5-week ceiling.
You can still proceed, but you have to record a reason first, and that reason follows onto
the audit record and the draft.

**Action `Increase next order`** blocks. Standard lead time is 7 days, so the earliest
possible receipt falls after the required date. Expediting is the only way to make it.

Which rules block and which only warn is set in `policy.js`, not buried in code. MOQ and
lead time are physical constraints, so they block. Cover is a policy preference, so it
warns and lets the buyer override it on the record. Nothing reaches D365 that couldn't
actually happen.

Worth noticing: the default proposal doesn't fully fix the problem. 4,800 cases arriving
July 11 takes projected stockout exposure from four days down to two, and the tool says
that plainly rather than showing a green tick. Move the date to July 9 and the quantity to
6,000 and it goes to zero.

## What's real and what isn't

Real: the guardrail engine, the inventory projection, the lead-time and MOQ arithmetic,
the cover calculation, the block/warn/override behaviour, the audit record, and the fact
that nothing is ever auto-submitted.

Not real: the data. Meridian provided none, so I made it up. One product, one distribution
centre, one week. The numbers live in `scenario.js` and the thresholds in `policy.js`.
[ASSUMPTIONS.md](ASSUMPTIONS.md) lists every fabricated value along with the data model
underneath it.

Also not built: turning the email into a structured signal is a scripted step here, not a
language model, and nothing talks to Outlook, Teams, Databricks or D365.
[ARCHITECTURE.md](ARCHITECTURE.md) covers how that would work in tenant.

## Why it doesn't suggest a quantity

The buyer proposes, the system validates. That split is deliberate.

Meridian's buyers already trust the min/max automation in D365 because it's transparent,
boring, and scoped where it can't hurt them. This tries to earn trust the same way. Their
judgment was never the broken part. The eleven days a signal spends sitting in an inbox
was.

## Files

| | |
|---|---|
| `index.html` `styles.css` `app.js` | the walkthrough |
| `guardrails.js` | the engine — pure functions, no DOM, no network, so the same code runs in the browser and under Node |
| `policy.js` | thresholds, and which rules block versus warn. All placeholders |
| `scenario.js` | the mocked inventory position. All invented |

No dependencies and nothing to install. Opening `index.html` needs a local server, since
it loads ES modules — the hosted link above is easier.
