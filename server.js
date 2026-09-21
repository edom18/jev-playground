// Jev playground: serves index.html and proxies the TypeSafe API.
// A proxy is required because api.typesafe.ai rejects browser origins (CORS).
// The server holds no API key: each visitor sets their own key in the page,
// and the proxy forwards their Authorization header as-is. Never log it.
//
//   node server.js      (PORT defaults to 8787)

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const UPSTREAM = "https://api.typesafe.ai";
const PORT = Number(process.env.PORT) || 8787;
const MAX_BODY_BYTES = 1024 * 1024;

const ROUTES = {
  "POST /api/systemone": "/v1/systemone",
  "GET /api/models": "/v1/models",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function proxy(req, res, upstreamPath) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    sendJson(res, 401, { error: "Missing Authorization header. Set your API key in the playground settings." });
    return;
  }

  const body = req.method === "POST" ? await readBody(req) : undefined;
  const startedAt = performance.now();
  const upstream = await fetch(UPSTREAM + upstreamPath, {
    method: req.method,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body,
  });
  const text = await upstream.text();
  const upstreamMs = Math.round(performance.now() - startedAt);

  // Status and body pass through untouched so 401 / 422 / 429 / 529 stay visible.
  res.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") || "application/json",
    "X-Upstream-Ms": String(upstreamMs),
    "X-Typesafe-Request-Id": upstream.headers.get("x-typesafe-request-id") || "",
  });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  try {
    const upstreamPath = ROUTES[`${req.method} ${req.url}`];
    if (upstreamPath) {
      await proxy(req, res, upstreamPath);
    } else if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(path.join(__dirname, "index.html")).pipe(res);
    } else {
      sendJson(res, 404, { error: "Not found" });
    }
  } catch (err) {
    sendJson(res, 502, { error: `Proxy failed: ${err.message}` });
  }
});

server.listen(PORT, () => {
  console.log(`Jev playground: http://localhost:${PORT}`);
});
