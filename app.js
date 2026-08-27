const state = {
  step: 0,
  forwarded: false,
  proposal: {
    action: "Increase + expedite",
    quantity: "4,800",
    requiredDate: "July 11, 2026",
    supplier: "NorthStar Bottling",
    rationale: "ValueFresh reports Glacier Water is selling materially above plan during the Minnesota heatwave. Increase the next receipt and expedite delivery to reduce near-term stockout exposure."
  }
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

const app = document.querySelector("#app");
const journey = document.querySelector("#journey");
const backButton = document.querySelector("#backButton");
const nextButton = document.querySelector("#nextButton");
const resetButton = document.querySelector("#resetButton");
const stepCaption = document.querySelector("#stepCaption");

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

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
    "A simple checklist tests the proposal against operational guardrails.",
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
    <div class="sender"><div class="avatar">ER</div><div class="sender-meta"><strong>Elena Ruiz &lt;eruiz@valuefresh.example&gt;</strong><span>To: Marcus Hill · Meridian Beverages · Today, 9:14 AM</span></div></div>
    <div class="mail-body"><p>Hi Marcus,</p><p>Glacier Water is moving much faster than expected across our Minnesota stores as the heatwave continues. Several locations are already below a week of inventory.</p><div class="mail-callout"><strong>Buyer signal:</strong> Please review whether Meridian can increase and accelerate the next shipment. We need an answer before tomorrow’s replenishment cutoff.</div><p>Thanks,<br/>Elena</p></div>
    ${showForward ? `<div class="forward-card"><div><strong>Forward to internal purchasing workflow</strong><div class="forward-address">purchasing-signals@meridian.example</div></div><button class="primary-button" id="sendForward">Send</button></div>` : ""}`;
}

function teamsShell(content, activeChannel = "Purchasing signals") {
  return `<div class="teams-layout">
    <aside class="teams-rail"><div class="teams-icon"><strong>☰</strong>Activity</div><div class="teams-icon active"><strong>T</strong>Teams</div><div class="teams-icon"><strong>☏</strong>Chat</div></aside>
    <aside class="teams-nav"><h3>Teams</h3><div class="team-name">Supply Planning</div><div class="channel ${activeChannel === "Purchasing signals" ? "active" : ""}">Purchasing signals</div><div class="channel">Buyer actions</div><div class="channel">Exceptions</div></aside>
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
  return `<div class="proposal-grid"><section class="form-panel"><div class="panel-heading"><h3>Buyer proposal</h3><p>Enter the purchasing action you recommend. The workflow will validate—not make—the decision.</p></div><div class="form-body">
    <div class="form-row"><div class="field"><label for="action">Action</label><select id="action"><option selected>Increase + expedite</option><option>Increase next order</option><option>Expedite current order</option><option>No change</option></select></div><div class="field"><label for="quantity">Additional quantity (cases)</label><input id="quantity" value="${escapeHtml(p.quantity)}" inputmode="numeric" /></div></div>
    <div class="form-row"><div class="field"><label for="requiredDate">Required date</label><input id="requiredDate" value="${escapeHtml(p.requiredDate)}" /></div><div class="field"><label for="supplier">Supplier</label><select id="supplier"><option selected>NorthStar Bottling</option><option>Great Lakes Beverage Co.</option></select></div></div>
    <div class="field"><label for="rationale">Buyer rationale</label><textarea id="rationale">${escapeHtml(p.rationale)}</textarea></div>
  </div></section><aside class="context-panel"><div class="panel-heading"><h3>Available decision context</h3><p>Illustrative internal data assembled around the signal</p></div><div class="panel-body">
    <div class="context-section"><h4>Inventory position</h4><div class="context-row"><span>Minnesota DC on hand</span><strong>6,200 cases</strong></div><div class="context-row"><span>Open purchase orders</span><strong>8,000 cases</strong></div><div class="context-row"><span>Projected stockout risk</span><strong>July 10</strong></div></div>
    <div class="context-section"><h4>Supplier context</h4><div class="context-row"><span>Approved supplier</span><strong>Yes</strong></div><div class="context-row"><span>Standard lead time</span><strong>5 days</strong></div><div class="context-row"><span>Minimum order quantity</span><strong>1,200 cases</strong></div></div>
    <div class="context-note"><strong>Source boundaries:</strong> retailer email, Monday planning export and operational records are shown as mocked internal inputs. Production access must be validated with Meridian IT.</div>
  </div></aside></div>`;
}

function validationView() {
  return `<div class="validation-wrap"><section class="validation-panel"><div class="panel-heading"><h3>Guardrail validation</h3><p>Simple operational checks applied to the buyer’s proposed action</p></div><div class="checklist">
    <div class="check"><div class="status-icon">✓</div><strong>Inventory + open POs</strong><p>Projected stockout occurs before the next currently scheduled receipt.</p></div>
    <div class="check"><div class="status-icon">✓</div><strong>Supplier + MOQ</strong><p>NorthStar is approved and 4,800 cases satisfies the 1,200-case MOQ.</p></div>
    <div class="check"><div class="status-icon">✓</div><strong>Lead time</strong><p>Requested date is feasible only with the selected expedite action.</p></div>
    <div class="check"><div class="status-icon">✓</div><strong>Resulting cover</strong><p>Resulting inventory remains within the provisional maximum cover.</p></div>
    <div class="check"><div class="status-icon warning">!</div><strong>Approval requirement</strong><p>Buyer confirmation is required before preparing the D365 draft.</p></div>
    <div class="readiness warning"><strong>Ready for buyer confirmation</strong>Four checks pass. One required approval remains: buyer confirmation.</div>
  </section><aside class="confirmation-panel"><div class="panel-heading"><h3>Proposed order</h3><p>Buyer-owned fields carried forward unchanged</p></div><div class="panel-body order-summary">${summaryRows()}</div></aside></div>`;
}

function summaryRows() {
  const p = state.proposal;
  return `<div class="summary-row"><span>Product</span><strong>Glacier Water</strong></div><div class="summary-row"><span>Action</span><strong>${escapeHtml(p.action)}</strong></div><div class="summary-row"><span>Quantity</span><strong>${escapeHtml(p.quantity)} cases</strong></div><div class="summary-row"><span>Required date</span><strong>${escapeHtml(p.requiredDate)}</strong></div><div class="summary-row"><span>Supplier</span><strong>${escapeHtml(p.supplier)}</strong></div><div class="summary-row"><span>Destination</span><strong>Minnesota DC</strong></div>`;
}

function confirmationView() {
  return `<div class="proposal-grid"><section class="confirmation-panel"><div class="confirm-banner"><strong>All required information is ready</strong>The proposal can now be confirmed or returned for modification.</div><div class="panel-heading"><h3>Buyer confirmation</h3><p>Your confirmation authorizes preparation of an unsaved D365 purchase-order draft.</p></div><div class="panel-body order-summary">${summaryRows()}<div class="audit"><strong>Audit record prepared</strong><br/>Source email retained · Buyer proposal captured · Guardrails evaluated · Final confirmation pending</div></div></section>
  <aside class="context-panel"><div class="panel-heading"><h3>Decision ownership</h3><p>What the buyer owns versus what the workflow supports</p></div><div class="panel-body"><div class="context-section"><h4>Buyer owns</h4><div class="context-row"><span>Interpret context</span><strong>✓</strong></div><div class="context-row"><span>Propose order action</span><strong>✓</strong></div><div class="context-row"><span>Modify or confirm</span><strong>✓</strong></div></div><div class="context-section"><h4>Workflow supports</h4><div class="context-row"><span>Structure the signal</span><strong>✓</strong></div><div class="context-row"><span>Apply guardrails</span><strong>✓</strong></div><div class="context-row"><span>Prepare handoff + audit</span><strong>✓</strong></div></div></div></aside></div>`;
}

function dynamicsView() {
  const p = state.proposal;
  return `<div class="dynamics-layout"><aside class="dynamics-nav"><div class="dynamics-brand"><span>◈</span> Dynamics 365</div><div class="dynamics-nav-item">Home</div><div class="dynamics-nav-item">Procurement</div><div class="dynamics-nav-item active">Purchase orders</div><div class="dynamics-nav-item">Vendors</div><div class="dynamics-nav-item">Inventory</div></aside><section class="dynamics-main">
    <div class="dynamics-command"><button class="command disabled">Save</button><button class="command disabled">Submit</button><button class="command">Validate</button><button class="command">More options</button></div>
    <div class="record"><div class="record-heading"><div><h2>New purchase order</h2><p>Prefilled from confirmed Meridian purchasing action</p></div><span class="draft-badge">Prefilled draft—not submitted</span></div>
    <section class="record-section"><h3>Purchase order header</h3><div class="record-fields"><div class="record-field"><label>Vendor account</label><div class="record-value">NSB-1042 · NorthStar Bottling</div></div><div class="record-field"><label>Delivery location</label><div class="record-value">MN-DC · Minnesota Distribution Center</div></div><div class="record-field"><label>Requested receipt date</label><div class="record-value">${escapeHtml(p.requiredDate)}</div></div><div class="record-field"><label>Buyer group</label><div class="record-value">BEV-WATER</div></div><div class="record-field"><label>Order status</label><div class="record-value">Draft</div></div><div class="record-field"><label>Workflow reference</label><div class="record-value">SIG-2026-0711-004</div></div></div></section>
    <section class="record-section"><h3>Purchase order lines</h3><table class="line-table"><thead><tr><th>Item</th><th>Description</th><th>Quantity</th><th>Unit</th><th>Site</th><th>Warehouse</th><th>Delivery mode</th></tr></thead><tbody><tr><td>GW-24-500</td><td>Glacier Water 24 × 500ml</td><td>${escapeHtml(p.quantity)}</td><td>Case</td><td>MN</td><td>MN-DC</td><td>Expedited</td></tr></tbody></table></section>
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
  renderJourney();
  backButton.disabled = state.step === 0;
  nextButton.textContent = ["Open forwarding action", "Send and open Teams", "Review purchasing action", "Validate proposal", "Continue to confirmation", "Confirm and prepare draft", "Restart demo"][state.step];
  stepCaption.innerHTML = `<strong>Step ${state.step + 1} of ${steps.length}</strong>${steps[state.step].title}`;
  document.querySelector("#forwardAction")?.addEventListener("click", () => goToStep(1));
  document.querySelector("#sendForward")?.addEventListener("click", () => { state.forwarded = true; goToStep(2); });
  document.querySelector("#reviewSignal")?.addEventListener("click", () => goToStep(3));
}

function renderJourney() {
  journey.innerHTML = steps.map((step, index) => `<button class="journey-step ${index === state.step ? "active" : ""} ${index < state.step ? "complete" : ""}" data-step="${index}" ${index > Math.max(state.step + 1, 1) ? "disabled" : ""}><span class="journey-index">0${index + 1} · ${step.app}</span>${step.short}</button>`).join("");
  journey.querySelectorAll("button:not([disabled])").forEach(button => button.addEventListener("click", () => goToStep(Number(button.dataset.step))));
}

function goToStep(nextStep) {
  if (state.step === 3) saveProposal();
  state.step = Math.max(0, Math.min(steps.length - 1, nextStep));
  renderStep();
  const stepHeading = document.querySelector(".stage-intro h2");
  stepHeading?.setAttribute("tabindex", "-1");
  stepHeading?.focus({ preventScroll: true });
  document.querySelector(".stage")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

backButton.addEventListener("click", () => goToStep(state.step - 1));
nextButton.addEventListener("click", () => state.step === steps.length - 1 ? reset() : goToStep(state.step + 1));
resetButton.addEventListener("click", reset);
function reset() { state.step = 0; state.forwarded = false; renderStep(); }

renderStep();
