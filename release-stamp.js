// The offline cache name is derived from the app files themselves, so every release
// that changes any file reaches phones without anyone remembering to bump a version.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const MARK = "exercise-studio-dev";
function files(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(e => e.isDirectory() ? files(path.join(dir, e.name), prefix + e.name + "/") : [prefix + e.name]);
}
function stamp(publicDir) {
  const hash = crypto.createHash("sha256");
  for (const name of files(publicDir)) { hash.update(name + "\0"); hash.update(fs.readFileSync(path.join(publicDir, name))); hash.update("\0"); }
  return hash.digest("hex").slice(0, 12);
}
function serviceWorker(publicDir) {
  const source = fs.readFileSync(path.join(publicDir, "sw.js"), "utf8");
  if (!source.includes(MARK)) throw new Error("sw.js is missing the cache-name marker");
  return source.split(MARK).join("exercise-studio-" + stamp(publicDir));
}
module.exports = { stamp, serviceWorker, MARK };
