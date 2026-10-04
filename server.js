// Exercise Studio server: serves the app and keeps the workout log in data/state.json.
// No dependencies. Works on Node 18 or newer.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 4320;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const FILE = path.join(DATA_DIR, "state.json");
const PUBLIC = path.join(__dirname, "public");
const MAX_BODY = 300 * 1024;

fs.mkdirSync(DATA_DIR, { recursive: true });
let state = { profile: null, days: {} };
try {
  state = Object.assign(state, JSON.parse(fs.readFileSync(FILE, "utf8")));
} catch (e) {
  if (e.code !== "ENOENT") {
    console.error("Could not read " + FILE + ": " + e.message);
    process.exit(1); // never start from empty over a damaged log
  }
}

function persist() {
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, FILE);
}
function send(res, code, body, type) {
  res.writeHead(code, { "Content-Type": type || "application/json", "Cache-Control": "no-store" });
  res.end(body);
}
function readJson(req, cb) {
  let buf = "", over = false;
  req.on("data", c => { buf += c; if (buf.length > MAX_BODY) { over = true; req.destroy(); } });
  req.on("end", () => {
    if (over) return cb(new Error("too large"));
    try {
      const v = JSON.parse(buf);
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("not an object");
      cb(null, v);
    } catch (e) { cb(e); }
  });
}
const DAY = /^\/api\/days\/(\d{4}-\d{2}-\d{2})$/;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".ico": "image/x-icon" };

http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url === "/api/state" && req.method === "GET") return send(res, 200, JSON.stringify(state));
  if (url === "/api/profile" && req.method === "PUT") {
    return readJson(req, (err, body) => {
      if (err) return send(res, 400, '{"error":"bad request"}');
      state.profile = body; persist(); send(res, 200, '{"ok":true}');
    });
  }
  const m = DAY.exec(url);
  if (m && req.method === "PUT") {
    return readJson(req, (err, body) => {
      if (err || !Array.isArray(body.entries)) return send(res, 400, '{"error":"bad request"}');
      state.days[m[1]] = body; persist(); send(res, 200, '{"ok":true}');
    });
  }
  if (m && req.method === "DELETE") { delete state.days[m[1]]; persist(); return send(res, 200, '{"ok":true}'); }
  if (url.startsWith("/api/")) return send(res, 404, '{"error":"not found"}');
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed", "text/plain");

  const file = path.normalize(path.join(PUBLIC, url === "/" ? "index.html" : decodeURIComponent(url)));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, "Forbidden", "text/plain");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain");
    send(res, 200, data, TYPES[path.extname(file)] || "application/octet-stream");
  });
}).listen(PORT, "0.0.0.0", () => console.log("Exercise Studio running on port " + PORT));
