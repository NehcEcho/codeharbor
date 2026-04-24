import { createReadStream, existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 1657);
const DIST_DIR = path.join(__dirname, "..", "dist");
const INDEX_HTML = path.join(DIST_DIR, "index.html");
const PROXY_PREFIX = "/api/opencode";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "host",
]);

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function createUpstreamHeaders(req, username, password) {
  const headers = new Headers();

  Object.entries(req.headers).forEach(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.startsWith("x-opencode-")) return;
    if (normalizedKey === "authorization") return;
    if (HOP_BY_HOP_HEADERS.has(normalizedKey)) return;

    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
      return;
    }

    if (typeof value === "string") {
      headers.set(key, value);
    }
  });

  headers.set("Authorization", `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`);
  if (!headers.has("Content-Type") && typeof req.headers["content-type"] === "string") {
    headers.set("Content-Type", req.headers["content-type"]);
  }
  return headers;
}

async function proxyOpencodeRequest(req, res) {
  const targetBaseUrl = req.headers["x-opencode-base-url"];
  const username = req.headers["x-opencode-username"];
  const password = req.headers["x-opencode-password"];

  if (typeof targetBaseUrl !== "string") {
    sendJson(res, 400, { error: "Missing x-opencode-base-url header" });
    return;
  }

  if (typeof username !== "string" || typeof password !== "string") {
    sendJson(res, 400, { error: "Missing OpenCode credentials headers" });
    return;
  }

  const upstreamPath = req.url.startsWith(PROXY_PREFIX) ? req.url.slice(PROXY_PREFIX.length) || "/" : req.url;
  const targetUrl = `${trimTrailingSlash(targetBaseUrl)}${upstreamPath}`;

  try {
    const method = req.method || "GET";
    const wantsEventStream = (req.headers.accept || "").includes("text/event-stream");
    const body = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(req);
    const response = await fetch(targetUrl, {
      method,
      headers: createUpstreamHeaders(req, username, password),
      body: body ? new Uint8Array(body) : undefined,
    });

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

    if (wantsEventStream && response.body) {
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      for await (const chunk of response.body) {
        res.write(Buffer.from(chunk));
      }
      res.end();
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    sendJson(res, 502, {
      error: error instanceof Error ? error.message : "Proxy request failed",
    });
  }
}

async function serveStaticAsset(req, res) {
  const reqPath = req.url === "/" ? "/index.html" : req.url;
  const pathname = decodeURIComponent((reqPath || "/").split("?")[0]);
  const normalizedPath = path.normalize(path.join(DIST_DIR, pathname));

  if (!normalizedPath.startsWith(DIST_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  const isFileRequest = path.extname(normalizedPath) !== "";
  if (isFileRequest && !existsSync(normalizedPath)) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }
  const filePath = isFileRequest && existsSync(normalizedPath) ? normalizedPath : INDEX_HTML;

  try {
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Length": stats.size,
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    });
    createReadStream(filePath).pipe(res);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: "Invalid request URL" });
    return;
  }

  if (req.url.startsWith(PROXY_PREFIX)) {
    await proxyOpencodeRequest(req, res);
    return;
  }

  await serveStaticAsset(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`OpenCode Remote listening on http://${HOST}:${PORT}`);
});
