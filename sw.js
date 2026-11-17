/* Gym Arc – Offline-Modus + Mitteilungen bei Pausenende */
const C = "gym-arc-v6";
const SHELL = ["./", "index.html", "standalone.js", "config.js", "manifest.webmanifest", "icon-180.png?v=2", "icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (u.origin !== location.origin && !font) return;   // Supabase/Claude nie zwischenspeichern
  // immer beim Server nachfragen (no-cache), damit neue Versionen sofort ankommen statt bis zu 10 Min. später
  const fresh = u.origin === location.origin ? fetch(u.href, { cache: "no-cache", credentials: "same-origin" }) : fetch(r);
  e.respondWith(fresh.then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Satzpause vorbei", {
    body: d.body || "", tag: "gym-rest", renotify: true, icon: "icon-192.png", badge: "icon-192.png"
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
