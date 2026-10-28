// Clinic Ledger works offline: the app and its libraries are kept on the device.
// Records are saved on the device by Firebase and upload when the internet is back.
const CACHE = "ledger-v27";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./firebase-config.js", "./icons/gu-icon-192.png", "./icons/gu-icon-512.png", "./icons/gu-apple-touch-icon.png", "./icons/gu-logo.png"];
const LIBS = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
];
const CDN = h => h.includes("gstatic.com") || h.includes("fonts.googleapis.com") || h.includes("cdnjs.cloudflare.com");

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).then(() =>
    Promise.all(LIBS.map(u => c.add(new Request(u, { mode: "cors" })).catch(() => {})))
  )).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("ledger-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.includes("firestore.googleapis.com") || url.hostname.includes("identitytoolkit") || url.hostname.includes("securetoken")) return;
  const mine = url.origin === location.origin, lib = CDN(url.hostname);
  if (!mine && !lib) return;
  if (lib) {
    e.respondWith(caches.match(req).then(hit => hit && hit.ok ? hit : fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit || Response.error())));
    return;
  }
  // App files: newest from the internet, saved copy if offline or slower than 4 seconds
  e.respondWith(new Promise(resolve => {
    let done = false;
    const fallback = () => caches.match(req).then(r => r || caches.match("./index.html"));
    const timer = setTimeout(() => fallback().then(r => { if (r && !done) { done = true; resolve(r); } }), 4000);
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      clearTimeout(timer); if (!done) { done = true; resolve(res); }
    }).catch(() => { clearTimeout(timer); fallback().then(r => { if (!done) { done = true; resolve(r || Response.error()); } }); });
  }));
});
