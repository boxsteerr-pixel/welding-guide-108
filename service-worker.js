const CACHE_NAME = "welding-guide-108-v16";
const CACHE_PREFIX = "welding-guide-108-";
const APP_ROOT = new URL("./", self.location.href);
const CORE_ASSETS = [
  "./assets/images/centering-home-force.png",
  "./assets/images/centering-manual-exit.png",
  "./assets/images/secondary-cut-position-hmi.png",
  "./assets/images/auto-initial-conditions-annotated.png",
  "./assets/images/auto-mode-key-switch.png",
  "./assets/images/nozzle-auxiliary-gas-hmi.png",
  "./assets/images/nozzle-upper-outlet.png",
  "./assets/images/nozzle-lower-outlet.png",
  "./assets/images/hmi-exit-button-annotated.png",
  "./assets/images/hmi-plc-connection-alarm.png",
  "./assets/images/hmi-host-lan-connector.png",
  "./assets/images/hmi-start-screen-reference.png",
  "./assets/images/segment-focus-machine-adjustment-entry.png",
  "./assets/images/segment-focus-pulse-mode-on.png",
  "./assets/images/table-controller-annotated-corrected.png",
  "./assets/images/table-original-position-reset.png",
  "./assets/images/chiller-overview.png",
  "./assets/images/chiller-2-panel.png",
  "./assets/images/chiller-1-panel.png",
  "./assets/images/chiller-switch-valves.png",
  "./css/mobile-header.css?v=2",
  "./js/system-time.js?v=1",
  "./",
  "./index.html",
  "./css/home-link.css?v=5",
  "./css/style.css",
  "./css/style.css?v=9",
  "./js/app.js",
  "./js/app.js?v=9",
  "./js/update-state.js?v=2",
  "./data/manual.json",
  "./manifest.json",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
].map(function (path) { return new URL(path, APP_ROOT).toString(); });

function isCacheable(response) {
  return response && response.ok && response.type !== "opaque";
}

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(CORE_ASSETS); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (name) {
        return name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME;
      }).map(function (name) { return caches.delete(name); }));
    })
  ]));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return caches.match(new URL("./index.html", APP_ROOT).toString());
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(APP_ROOT.pathname)) return;
  if (request.mode === "navigate" || ["document", "script", "style", "manifest"].includes(request.destination) || url.pathname.endsWith("/data/manual.json")) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (["image", "font", "video", "audio"].includes(request.destination)) event.respondWith(cacheFirst(request));
});
