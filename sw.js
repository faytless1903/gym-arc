/* Gym Arc – Offline-Modus + Mitteilungen bei Pausenende */
const C = "gym-arc-v7";
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
  const title = d.title || "Satzpause vorbei";
  // Art der Mitteilung → wohin ein Tippen führt
  const kind = /pause/i.test(title) ? "rest" : /wiegen/i.test(title) ? "weigh" : /eiwei/i.test(title) ? "protein" : "";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "", tag: "gym-" + (kind || "info"), renotify: true, icon: "icon-192.png", badge: "icon-192.png", data: { kind }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const kind = (e.notification.data && e.notification.data.kind) || "";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ("focus" in c) { if (kind) c.postMessage({ gaOpen: kind }); return c.focus(); }
    return self.clients.openWindow(kind ? "./?open=" + kind : "./");
  }));
});
