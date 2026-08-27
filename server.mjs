import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };

http.createServer(async (req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  try {
    const body = await fs.readFile(path.join(root, safePath));
    res.writeHead(200, { "content-type": types[path.extname(safePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}).listen(port, "0.0.0.0", () => console.log(`Meridian prototype: http://localhost:${port}`));
