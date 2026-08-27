import fs from "node:fs/promises";

const html = await fs.readFile("index.html", "utf8");
const js = await fs.readFile("app.js", "utf8");
const css = await fs.readFile("styles.css", "utf8");
const required = ["Outlook", "Teams", "Buyer proposal", "Guardrail validation", "Dynamics 365", "Prefilled draft—not submitted"];
for (const term of required) {
  if (!html.includes(term) && !js.includes(term)) throw new Error(`Missing required flow content: ${term}`);
}
if (!js.includes("renderStep") || !js.includes("goToStep")) throw new Error("Click-through navigation is missing");
if (!css.includes("@media")) throw new Error("Responsive styles are missing");
console.log("Prototype content and navigation checks passed.");
