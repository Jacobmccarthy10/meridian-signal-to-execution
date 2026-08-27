import fs from "node:fs/promises";
import path from "node:path";

await fs.rm("dist", { recursive: true, force: true });
await fs.mkdir("dist", { recursive: true });
for (const file of ["index.html", "styles.css", "app.js"]) {
  await fs.copyFile(file, path.join("dist", file));
}
console.log("Built static prototype in dist/");
