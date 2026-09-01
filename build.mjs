import fs from "node:fs/promises";
import path from "node:path";

/**
 * Two outputs:
 *   dist/                                  - the multi-file prototype, served by server.mjs
 *   Meridian-Signal-to-Execution.html      - one self-contained file, no server, no install.
 *
 * The standalone file is the thing you send. It is generated: edit the sources,
 * not the bundle.
 */

const SOURCES = ["index.html", "styles.css", "app.js", "policy.js", "scenario.js", "guardrails.js"];
const MODULE_ORDER = ["policy.js", "scenario.js", "guardrails.js", "app.js"];
const STANDALONE = "Meridian-Signal-to-Execution.html";

await fs.rm("dist", { recursive: true, force: true });
await fs.mkdir("dist", { recursive: true });
for (const file of SOURCES) {
  await fs.copyFile(file, path.join("dist", file));
}

/** Flatten ES modules into one classic script: drop imports, unwrap exports. */
function flatten(source) {
  return source
    .split("\n")
    .filter(line => !/^import\s.*from\s.*;?\s*$/.test(line))
    .map(line => line.replace(/^export\s+(?=(const|let|var|function|class)\s)/, ""))
    .join("\n")
    .trim();
}

const html = await fs.readFile("index.html", "utf8");
const css = await fs.readFile("styles.css", "utf8");

const bundle = [];
for (const file of MODULE_ORDER) {
  const source = await fs.readFile(file, "utf8");
  bundle.push("/* ===== " + file + " ".repeat(Math.max(1, 28 - file.length)) + "===== */\n" + flatten(source));
}

const standalone = html
  .replace(
    /<link rel="stylesheet" href="styles\.css"\s*\/?>/,
    "<style>\n" + css.trim() + "\n  </style>"
  )
  .replace(
    /<script type="module" src="app\.js"><\/script>/,
    "<script>\n" + bundle.join("\n\n") + "\n  </script>"
  );

if (standalone.includes("styles.css") || standalone.includes("src=\"app.js\"")) {
  throw new Error("Inlining failed - the standalone file still references external assets.");
}
if (/^\s*(import|export)\s/m.test(bundle.join("\n"))) {
  throw new Error("Inlining failed - module syntax survived into the bundle.");
}

await fs.writeFile(STANDALONE, standalone, "utf8");
await fs.writeFile(path.join("dist", STANDALONE), standalone, "utf8");

const kb = (Buffer.byteLength(standalone, "utf8") / 1024).toFixed(0);
console.log("Built dist/ (" + SOURCES.length + " files)");
console.log("Built " + STANDALONE + " - " + kb + " KB, self-contained, opens with a double-click");
