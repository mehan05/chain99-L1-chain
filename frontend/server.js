// =============================================================
// Chain99 — Frontend Server (Pure Node.js, Zero Dependencies)
// =============================================================
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon"
};

const server = http.createServer((req, res) => {
  // Enable CORS for all incoming requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Optional RPC Proxy to guarantee zero CORS issues with Geth
  if (req.url === "/api/rpc" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      const gethReq = http.request({
        hostname: "127.0.0.1",
        port: 8545,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      }, (gethRes) => {
        res.writeHead(gethRes.statusCode, { "Content-Type": "application/json" });
        gethRes.pipe(res);
      });

      gethReq.on("error", (err) => {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: `Cannot connect to Geth RPC at 127.0.0.1:8545: ${err.message}` },
          id: null
        }));
      });

      gethReq.write(body);
      gethReq.end();
    });
    return;
  }

  // Static File Serving
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/") reqPath = "/index.html";

  const filePath = path.join(PUBLIC_DIR, reqPath);

  // Security: prevent path traversal outside frontend directory
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("File Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 Chain99 Mission Control & Explorer is running!`);
  console.log(`  🌐 URL: http://localhost:${PORT}`);
  console.log(`  ⛓️  Target RPC: http://127.0.0.1:8545 (Chain ID 9999)`);
  console.log(`======================================================\n`);
});
