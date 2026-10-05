// Exercise Studio server: serves the app, keeps the workout log in data/state.json,
// stores progress photos in data/photos and keeps daily backups in data/backups.
// No dependencies. Works on Node 18 or newer.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
const VERSION = require("./package.json").version;

const PORT = Number(process.env.PORT) || 4320;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const FILE = path.join(DATA_DIR, "state.json");
const PHOTOS = path.join(DATA_DIR, "photos");
const BACKUPS = path.join(DATA_DIR, "backups");
const PUBLIC = path.join(__dirname, "public");
const KEEP_BACKUPS = 30;

for (const d of [DATA_DIR, PHOTOS, BACKUPS]) fs.mkdirSync(d, { recursive: true });
let state = { profile: null, days: {}, revisions: { profile: 0, days: {} } };
try {
  state = Object.assign(state, JSON.parse(fs.readFileSync(FILE, "utf8")));
} catch (e) {
  if (e.code !== "ENOENT") {
    console.error("Could not read " + FILE + ": " + e.message);
    process.exit(1); // never start from empty over a damaged log
  }
}

state.revisions = state.revisions || { profile: 0, days: {} };
function versionCheck(req, res, key) {
  const revision = key === "profile" ? state.revisions.profile : (state.revisions.days[key] || 0);
  if (req.headers["if-match"] !== String(revision)) {
    send(res, req.headers["if-match"] === undefined ? 428 : 409, JSON.stringify({ error: "revision required or changed", revision, current: key === "profile" ? state.profile : state.days[key] || null }));
    return false;
  }
  return true;
}
function changed(res, key) {
  const revision = key === "profile" ? ++state.revisions.profile : (state.revisions.days[key] = (state.revisions.days[key] || 0) + 1);
  persist();
  send(res, 200, JSON.stringify({ ok: true, revision }));
}

const today = () => new Date().toISOString().slice(0, 10);
function backup(force) {
  if (!fs.existsSync(FILE)) return;
  const name = force ? "state-" + today() + "-" + Date.now() + ".json" : "state-" + today() + ".json";
  const dest = path.join(BACKUPS, name);
  if (!force && fs.existsSync(dest)) return;

  const archive = path.join(BACKUPS, name.replace(/\.json$/, ".tar.gz"));
  const packed = spawnSync("tar", ["-czf", archive + ".tmp", "-C", DATA_DIR, "state.json", "photos"]);
  if (packed.status !== 0) { try { fs.unlinkSync(archive + ".tmp"); } catch (_) {} throw new Error("Photo backup failed"); }
  fs.renameSync(archive + ".tmp", archive);
  fs.copyFileSync(FILE, dest);
  const all = fs.readdirSync(BACKUPS).filter(f => f.endsWith(".json")).sort();
  all.slice(0, Math.max(0, all.length - KEEP_BACKUPS)).forEach(f => { fs.unlinkSync(path.join(BACKUPS, f)); try { fs.unlinkSync(path.join(BACKUPS, f.replace(/\.json$/, ".tar.gz"))); } catch (_) {} });
}
function persist() {
  backup(false); // first change of the day keeps yesterday's file
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, FILE);
}
function send(res, code, body, type, extra) {
  res.writeHead(code, Object.assign({ "Content-Type": type || "application/json", "Cache-Control": "no-cache" }, extra || {}));
  res.end(body);
}
const ok = res => send(res, 200, '{"ok":true}');
const bad = res => send(res, 400, '{"error":"bad request"}');
function readBody(req, limit, cb) {
  const chunks = []; let size = 0, over = false;
  req.on("data", c => { size += c.length; if (size > limit) { over = true; req.destroy(); } else chunks.push(c); });
  req.on("end", () => cb(over ? new Error("too large") : null, Buffer.concat(chunks)));
  req.on("error", () => cb(new Error("aborted")));
}
function readJson(req, limit, cb) {
  readBody(req, limit, (err, buf) => {
    if (err) return cb(err);
    let v;
    try {
      v = JSON.parse(buf.toString("utf8"));
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("not an object");
    } catch (e) { return cb(e); }
    cb(null, v);
  });
}
const DAY = /^\/api\/days\/(\d{4}-\d{2}-\d{2})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHOTO = /^\d{4}-\d{2}-\d{2}-[0-9a-f]{8}\.jpg$/;
function validDay(day) {
  if (!day || !Array.isArray(day.entries) || day.entries.length > 200) return false;
  if (day.min !== undefined && (!Number.isFinite(day.min) || day.min < 0 || day.min > 1440)) return false;
  if (!day.entries.every(e => e && /^[a-zA-Z0-9_-]+$/.test(e.ex) && Array.isArray(e.sets) && e.sets.length <= 500 && e.sets.every(s => s &&
    ((Number.isFinite(s.r) && s.r > 0 && s.r <= 10000) || (Number.isFinite(s.s) && s.s > 0 && s.s <= 86400)) &&
    (s.kg === undefined || Number.isFinite(s.kg) && s.kg >= 0 && s.kg <= 1000) &&
    (s.side === undefined || ["left", "right"].includes(s.side))))) return false;
  if (day.plan) {
    const p = day.plan,sc = p.scheme;
    if (!Array.isArray(p.ids) || !p.ids.length || p.ids.length > 50 || !p.ids.every(id => /^[a-zA-Z0-9_-]+$/.test(id)) || new Set(p.ids).size !== p.ids.length || !Number.isInteger(p.sets) || p.sets < 1 || p.sets > 20 || typeof p.name !== "string" ||
      !sc || sc.sets !== p.sets || !["lo","hi","rest","hold"].every(k => Number.isFinite(sc[k]) && sc[k] > 0) || !Array.isArray(p.unilateral)) return false;
  }
  return true;
}
function sameRevisions(base) {
  if (!base || base.profile !== state.revisions.profile || !base.days) return false;
  const keys = new Set([...Object.keys(base.days), ...Object.keys(state.revisions.days)]);
  return [...keys].every(k => (base.days[k] || 0) === (state.revisions.days[k] || 0));
}
const TYPES = { ".mjs": "text/javascript; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8" };

http.createServer((req, res) => {
  const [url, query] = req.url.split("?");
  const m = req.method;
  if (url === "/api/health" && m === "GET") return send(res, 200, JSON.stringify({ ok: true, version: VERSION }), null, { "Cache-Control": "no-store" });
  if (url === "/api/archive" && m === "GET") {
    persist();
    const tar = spawn("tar", ["-czf", "-", "-C", DATA_DIR, "state.json", "photos"]);
    res.writeHead(200, { "Content-Type": "application/gzip", "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="exercise-studio-' + today() + '.tar.gz"' });
    tar.stdout.pipe(res);tar.stderr.resume();
    tar.on("error", () => res.destroy());tar.on("close", code => { if (code !== 0) res.destroy(); });
    res.on("close", () => tar.kill());return;
  }
  if (url === "/api/state" && m === "GET") return send(res, 200, JSON.stringify(state), null, { "Cache-Control": "no-store" });
  if (url === "/api/backup" && m === "GET") return send(res, 200, JSON.stringify(state, null, 1), null, { "Content-Disposition": 'attachment; filename="exercise-studio-backup-' + today() + '.json"', "Cache-Control": "no-store" });
  if (url === "/api/profile" && m === "PUT") {
    return readJson(req, 512 * 1024, (err, body) => { if (err) return bad(res); if (!versionCheck(req, res, "profile")) return; state.profile = body; changed(res, "profile"); });
  }
  if (url === "/api/restore" && m === "POST") {
    return readJson(req, 8 * 1024 * 1024, (err, body) => {
      if (err || !body.days || typeof body.days !== "object" || Array.isArray(body.days)) return bad(res);
      const days = {};
      for (const k of Object.keys(body.days)) { if (!DATE.test(k) || !validDay(body.days[k])) return bad(res); days[k] = body.days[k]; }
      if (!sameRevisions(body.baseRevisions)) return send(res, 409, '{"error":"Data changed; reload before restoring"}');
      backup(true);
      const revisions = { profile: state.revisions.profile + 1, days: {} };
      for (const k of new Set([...Object.keys(state.revisions.days), ...Object.keys(days)])) revisions.days[k] = (state.revisions.days[k] || 0) + 1;
      state = { profile: body.profile && typeof body.profile === "object" ? body.profile : null, days, revisions };
      persist(); ok(res);
    });
  }
  const dm = DAY.exec(url);
  if (dm && m === "PUT") {
    return readJson(req, 512 * 1024, (err, body) => { if (err || !validDay(body)) return bad(res); if (!versionCheck(req, res, dm[1])) return; state.days[dm[1]] = body; changed(res, dm[1]); });
  }
  if (dm && m === "DELETE") { if (!versionCheck(req, res, dm[1])) return; delete state.days[dm[1]]; return changed(res, dm[1]); }

  if (url === "/api/photos" && m === "GET") {
    const list = fs.readdirSync(PHOTOS).filter(f => PHOTO.test(f)).sort().map(f => ({ name: f, date: f.slice(0, 10) }));
    return send(res, 200, JSON.stringify(list), null, { "Cache-Control": "no-store" });
  }
  if (url === "/api/photos" && m === "POST") {
    const date = new URLSearchParams(query || "").get("date") || today();
    if (!DATE.test(date)) return bad(res);
    return readBody(req, 6 * 1024 * 1024, (err, buf) => {
      if (err || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return bad(res); // JPEG only
      const name = date + "-" + crypto.randomBytes(4).toString("hex") + ".jpg";
      backup(false);fs.writeFileSync(path.join(PHOTOS, name), buf);
      send(res, 200, JSON.stringify({ name, date }));
    });
  }
  if (url.startsWith("/api/photos/") && m === "DELETE") {
    const name = url.slice(12);
    if (!PHOTO.test(name)) return bad(res);
    backup(false);try { fs.unlinkSync(path.join(PHOTOS, name)); } catch (e) {}
    return ok(res);
  }
  if (url.startsWith("/api/")) return send(res, 404, '{"error":"not found"}');
  if (m !== "GET" && m !== "HEAD") return send(res, 405, "Method not allowed", "text/plain");

  if (url.startsWith("/photos/")) {
    const name = url.slice(8);
    if (!PHOTO.test(name)) return send(res, 404, "Not found", "text/plain");
    return fs.readFile(path.join(PHOTOS, name), (err, data) => err ? send(res, 404, "Not found", "text/plain") : send(res, 200, data, "image/jpeg", { "Cache-Control": "private, max-age=31536000" }));
  }
  let rel;
  try { rel = decodeURIComponent(url); } catch (e) { return send(res, 400, "Bad request", "text/plain"); }
  const file = path.normalize(path.join(PUBLIC, rel === "/" ? "index.html" : rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, "Forbidden", "text/plain");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain");
    send(res, 200, data, TYPES[path.extname(file)] || "application/octet-stream");
  });
}).listen(PORT, "0.0.0.0", () => console.log("Exercise Studio running on port " + PORT));
