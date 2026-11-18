// Gym Arc – Server-Funktion "push" (Supabase Edge Function)
// Schickt eine Mitteilung aufs iPhone, wenn die Satzpause vorbei ist – auch bei gesperrtem Bildschirm.
// Keine eigenen Secrets nötig: Die Push-Schlüssel (VAPID) werden beim ersten Aufruf erzeugt und in der Datenbank gespeichert.
// Aktionen: key | subscribe | unsubscribe | schedule | cancel | tick (vom Zeitplaner) | test | morning / evening (vom Zeitplaner) | daily

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const BASE = Deno.env.get("SUPABASE_URL") || "";
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ---------- Datenbank (nur Server, Tabellen ohne Zugriff für die App) ----------
async function db(path: string, init: RequestInit = {}) {
  const r = await fetch(BASE + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error("db " + r.status + " " + (await r.text()));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// ---------- Web Push (RFC 8291 / 8292) mit WebCrypto ----------
/*WEBPUSH-START*/
const te = new TextEncoder();
function b64u(buf) {
  const b = new Uint8Array(buf); let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(s) {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function cat(...parts) {
  const n = parts.reduce((a, p) => a + p.length, 0); const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}
async function vapidNew() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = b64u(await crypto.subtle.exportKey("raw", kp.publicKey));
  const priv = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { pub, priv };
}
async function vapidJWT(endpoint, priv, sub) {
  const aud = new URL(endpoint).origin;
  const head = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub })));
  const key = await crypto.subtle.importKey("jwk", priv, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(head + "." + body));
  return head + "." + body + "." + b64u(sig);
}
async function encrypt(payload, p256dh, auth) {
  const ua = unb64u(p256dh), secret = unb64u(auth);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(secret, ecdh, cat(te.encode("WebPush: info\0"), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const k = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, cat(te.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
async function sendPush(sub, payload, keys, subject) {
  const body = await encrypt(payload, sub.keys.p256dh, sub.keys.auth);
  const jwt = await vapidJWT(sub.endpoint, keys.priv, subject);
  return fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: "vapid t=" + jwt + ", k=" + keys.pub,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "120",
      Urgency: "high",
    },
    body,
  });
}
/*WEBPUSH-END*/

let KEYS: { pub: string; priv: JsonWebKey } | null = null;
async function keys() {
  if (KEYS) return KEYS;
  let rows = await db("push_keys?id=eq.1&select=pub,priv");
  if (!rows.length) {
    const k = await vapidNew();
    await db("push_keys", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ id: 1, ...k }) });
    rows = await db("push_keys?id=eq.1&select=pub,priv");
  }
  KEYS = rows[0];
  return KEYS!;
}

async function userOf(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const u = await fetch(BASE + "/auth/v1/user", { headers: { Authorization: auth, apikey } });
  if (!u.ok) return null;
  const user = await u.json();
  return user && user.id ? user : null;
}

async function deliver(userId: string, title: string, body: string) {
  const subs = await db("push_subs?user_id=eq." + userId + "&select=endpoint,sub");
  const k = await keys();
  let sent = 0;
  for (const s of subs) {
    try {
      const r = await sendPush(s.sub, JSON.stringify({ title, body }), k, BASE || "https://supabase.co");
      if (r.status === 404 || r.status === 410) await db("push_subs?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE" });
      else if (r.ok) sent++;
      else console.log("push", r.status, await r.text());
    } catch (e) { console.log("push error", String(e)); }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");

    if (action === "key") return json({ pub: (await keys()).pub });

    if (action === "morning") { // vom Zeitplaner um 4:55 und 5:55 UTC – sendet nur, wenn es in Berlin 6:55 ist
      const now = new Date();
      const hm = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      if (!b.force && !/^06:5[3-9]$/.test(hm)) return json({ ok: true, skipped: hm });
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
      const rows = await db("push_daily?weigh=eq.true&select=user_id");
      let n = 0;
      for (const r of rows) {
        // schon gewogen? (Eintrag von heute im Dokument "body") → keine Erinnerung
        let done = false;
        try {
          const d = await db("docs?user_id=eq." + r.user_id + "&id=eq.body&select=data");
          done = !!(d[0] && d[0].data && (d[0].data.entries || []).some((e: { d: string }) => e && e.d === today));
        } catch (_) { /* im Zweifel erinnern */ }
        if (!done) n += await deliver(r.user_id, "Zeit zum Wiegen", "");
      }
      return json({ ok: true, sent: n });
    }

    if (action === "evening") { // vom Zeitplaner um 18:00 und 19:00 UTC – sendet nur, wenn es in Berlin 20:00 ist
      const now = new Date();
      const hm = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      if (!b.force && !/^20:0[0-4]$/.test(hm)) return json({ ok: true, skipped: hm });
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
      const rows = await db("push_daily?protein=eq.true&p_goal=gt.0&select=user_id,p_goal");
      let n = 0;
      for (const r of rows) {
        let p = 0;
        try {
          const d = await db("docs?user_id=eq." + r.user_id + "&id=eq.f" + today + "&select=data");
          const day = (d[0] && d[0].data) || {};
          for (const m of ["breakfast", "lunch", "dinner", "snack"]) for (const it of (day[m] || [])) p += +(it && it.p) || 0;
        } catch (_) { continue; } // im Zweifel nicht stören
        const gap = Math.round(r.p_goal - p);
        if (gap >= 15) n += await deliver(r.user_id, "Noch " + gap + " g Eiweiß offen", "");
      }
      return json({ ok: true, sent: n });
    }

    if (action === "tick") { // vom Zeitplaner (pg_cron) alle 2 Sekunden, nur wenn eine Pause fällig ist
      const due = await db("push_timers?due_at=lte." + encodeURIComponent(new Date(Date.now() + 1000).toISOString()) + "&select=user_id,due_at,title,body");
      let n = 0;
      for (const t of due) {
        // erst löschen, dann senden → jede Pause wird genau einmal gemeldet
        const del = await db("push_timers?user_id=eq." + t.user_id + "&due_at=eq." + encodeURIComponent(t.due_at), { method: "DELETE", headers: { Prefer: "return=representation" } });
        if (del && del.length) n += await deliver(t.user_id, t.title || "Pause vorbei", t.body || "");
      }
      return json({ ok: true, sent: n });
    }

    const user = await userOf(req);
    if (!user) return json({ code: "not_granted", message: "Nicht angemeldet" }, 401);

    if (action === "subscribe") {
      const s = b.sub;
      if (!s || !s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth) return json({ code: "invalid" }, 400);
      await db("push_subs?on_conflict=endpoint", {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ endpoint: s.endpoint, user_id: user.id, sub: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } } }),
      });
      return json({ ok: true });
    }
    if (action === "unsubscribe") {
      if (b.endpoint) await db("push_subs?user_id=eq." + user.id + "&endpoint=eq." + encodeURIComponent(b.endpoint), { method: "DELETE" });
      return json({ ok: true });
    }
    if (action === "schedule") {
      const at = Number(b.at);
      if (!at || at < Date.now() - 5000 || at > Date.now() + 30 * 60000) return json({ code: "invalid" }, 400);
      await db("push_timers?on_conflict=user_id", {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: user.id, due_at: new Date(at).toISOString(), title: String(b.title || "Pause vorbei").slice(0, 80), body: String(b.body || "").slice(0, 160) }),
      });
      return json({ ok: true });
    }
    if (action === "cancel") {
      await db("push_timers?user_id=eq." + user.id, { method: "DELETE" });
      return json({ ok: true });
    }
    if (action === "daily") {
      await db("push_daily?on_conflict=user_id", {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: user.id, weigh: !!b.weigh, protein: !!b.protein, p_goal: Math.max(0, Math.min(400, Math.round(+b.pGoal || 0))) }),
      });
      return json({ ok: true });
    }
    if (action === "test") return json({ ok: true, sent: await deliver(user.id, "Pause vorbei", "So sieht die Mitteilung aus 💪") });
    return json({ code: "invalid", message: "Unbekannte Aktion" }, 400);
  } catch (e) {
    return json({ code: "unavailable", message: String(e) }, 500);
  }
});
