const CACHE_NAME = "welding-guide-108-v23";
const CACHE_PREFIX = "welding-guide-108-";
const APP_ROOT = new URL("./", self.location.href);
const MEDIA_SOURCES = [
  "./assets/images/scrap-belt-flashing-stop.png",
  "./assets/images/scrap-belt-manual-to-auto.png",
  "./assets/images/scrap-belt-shear-adjustment-mode.png",
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
  "./assets/images/chiller-2-panel-status.png",
  "./assets/images/chiller-1-panel-startup.png",
  "./assets/images/chiller-switch-valves.png",
];
const MEDIA_ASSETS = MEDIA_SOURCES.map(function (path) { return new URL(path.replace(/\.png$/, ".webp"), APP_ROOT).toString(); });
const CORE_ASSETS = [
  "./css/mobile-header.css?v=2",
  "./js/system-time.js?v=1",
  "./",
  "./index.html",
  "./css/home-link.css?v=5",
  "./css/style.css",
  "./css/style.css?v=10",
  "./js/app.js",
  "./js/app.js?v=10",
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

let foregroundImages = 0;
let mediaCacheJob;
const pause = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };

async function fetchImage(request) {
  let error;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 15000);
    try {
      const response = await fetch(request, { signal: controller.signal, cache: attempt ? "reload" : "default", priority: foregroundImages ? "high" : "low" });
      if (!isCacheable(response)) throw new Error("Image HTTP " + response.status);
      return response;
    } catch (failure) { error = failure; }
    finally { clearTimeout(timer); }
  }
  throw error;
}

async function mediaProgress(client) {
  const cache = await caches.open(CACHE_NAME);
  let completed = 0;
  for (const url of MEDIA_ASSETS) if (await cache.match(url)) completed++;
  if (client) client.postMessage({ type: "MEDIA_PROGRESS", completed: completed, total: MEDIA_ASSETS.length });
  return completed;
}

async function cacheMedia(client) {
  const cache = await caches.open(CACHE_NAME);
  for (const url of MEDIA_ASSETS) {
    if (await cache.match(url)) continue;
    while (foregroundImages) await pause(250);
    try {
      const response = await fetchImage(url);
      await cache.put(url, response);
    } catch (_) { /* Preserve successful files; retry missing files on the next request. */ }
    await mediaProgress(client);
    await pause(300);
  }
  if (await mediaProgress(client) === MEDIA_ASSETS.length) await removeOldCaches();
}

async function removeOldCaches() {
  const names = await caches.keys();
  await Promise.all(names.filter(function (name) { return name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME; }).map(function (name) { return caches.delete(name); }));
}

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "CACHE_STATUS") event.waitUntil(mediaProgress(event.source));
  if (event.data && event.data.type === "CACHE_MEDIA") {
    if (!mediaCacheJob) mediaCacheJob = cacheMedia(event.source).finally(function () { mediaCacheJob = null; });
    event.waitUntil(mediaCacheJob);
  }
});

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(CORE_ASSETS); }));
});

self.addEventListener("activate", function (event) {
  // Keep old resources until this version has successfully cached all new images.
  event.waitUntil(self.clients.claim());
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      const cache = await caches.open(CACHE_NAME);
      try { await cache.put(request, response.clone()); } catch (_) { /* Storage limits must not hide a successful network response. */ }
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
  foregroundImages++;
  try {
    const response = await fetchImage(request);
    const cache = await caches.open(CACHE_NAME);
    try { await cache.put(request, response.clone()); } catch (_) { /* Allow viewing even when device storage is full. */ }
    return response;
  } finally { foregroundImages--; }
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(APP_ROOT.pathname)) return;
  if (request.mode === "navigate" || ["document", "script", "style", "manifest"].includes(request.destination) || url.pathname.endsWith("/data/manual.json")) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (["image", "font", "video", "audio"].includes(request.destination) || /\.(webp|png|jpe?g)$/.test(url.pathname)) event.respondWith(cacheFirst(request));
});
