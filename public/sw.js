// A complete versioned shell: never mix old scripts with a new document.
const CACHE = "exercise-studio-v5";
const SHELL = ["./", "index.html", "app.css", "workout.js", "figure-math.js", "boot.mjs", "vendor/three.module.js", "vendor/three.core.js", "fonts/archivo.ttf", "fonts/azeret-mono.ttf", "data.js", "figure.js", "app.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
function valid(response, url) {
  if (!response.ok || response.redirected) return false;
  const type = response.headers.get("Content-Type") || "";
  return (/\.m?js$/.test(url)) ? type.includes("javascript") : url.endsWith(".css") ? type.includes("text/css") : url.endsWith(".png") ? type.includes("image/png") : url.endsWith(".ttf") ? type.includes("font/ttf") : url.endsWith(".webmanifest") ? type.includes("manifest+json") : type.includes("text/html");
}
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const responses = await Promise.all(SHELL.map(async name => {
      const url = new URL(name, self.registration.scope).href;
      const response = await fetch(url, { cache: "reload", redirect: "error" });
      if (!valid(response, url)) throw Error("Invalid app asset: " + name);
      return [url, response];
    }));
    const cache = await caches.open(CACHE);
    await Promise.all(responses.map(([url, response]) => cache.put(url, response)));
    // Wait for current app tabs to close; never swap bundles under a workout.
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("exercise-studio-") && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url),scope = new URL(self.registration.scope);
  if (event.request.method !== "GET" || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) || url.pathname.includes("/api/") || url.pathname.includes("/photos/")) return;
  const relative = url.pathname.slice(scope.pathname.length);
  if (!SHELL.includes(relative) && relative !== "") return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(new URL(relative || "./", scope).href);
    if (event.request.mode === "navigate") {
      try {
        const response = await fetch(event.request);
        // Show sign-in or errors online without ever saving them as app files.
        return valid(response,url.href) ? cached || response : response;
      } catch (_) {
        return cached || await cache.match(new URL("index.html", scope).href) || Response.error();
      }
    }
    return cached || fetch(event.request);
  })());
});
