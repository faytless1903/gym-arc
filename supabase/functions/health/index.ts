// Gym Arc – Server-Funktion "health" (Supabase Edge Function)
// Nimmt Schritte und aktive Kalorien aus Apple Health entgegen (per iPhone-Kurzbefehl) und speichert sie im Dokument "health".
// Der Kurzbefehl meldet sich mit einem persönlichen Schlüssel an, den die App erzeugt (Zahnrad → Apple Health).
// Aktionen: newtoken (aus der App, angemeldet) | ohne action: Daten vom Kurzbefehl {token, steps, active, date?}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const BASE = Deno.env.get("SUPABASE_URL") || "";
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function db(path: string, init: RequestInit = {}) {
  const r = await fetch(BASE + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error("db " + r.status + " " + (await r.text()));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
// Zahlen aus dem Kurzbefehl können "9.812", "9812 Schritte" oder "420,5 kcal" sein
function numDe(v: unknown) {
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[^\d.,-]/g, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
const berlinDay = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));

    if (b.action === "newtoken") {
      const u = await fetch(BASE + "/auth/v1/user", {
        headers: { Authorization: req.headers.get("Authorization") || "", apikey: req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "" },
      });
      if (!u.ok) return json({ code: "not_granted", message: "Nicht angemeldet" }, 401);
      const user = await u.json();
      const bytes = crypto.getRandomValues(new Uint8Array(18));
      const token = "gh_" + Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
      await db("health_tokens?on_conflict=user_id", {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: user.id, token }),
      });
      return json({ token });
    }

    // Daten vom Kurzbefehl
    const tok = String(b.token || "").trim();
    if (!/^gh_[0-9a-f]{36}$/.test(tok)) return json({ ok: false, message: "Schlüssel fehlt oder falsch" }, 401);
    const rows = await db("health_tokens?token=eq." + tok + "&select=user_id");
    if (!rows.length) return json({ ok: false, message: "Schlüssel unbekannt – in der App neu erzeugen" }, 401);
    const uid = rows[0].user_id;
    const day = /^\d{4}-\d\d-\d\d$/.test(String(b.date || "")) ? String(b.date) : berlinDay();
    const steps = numDe(b.steps), active = numDe(b.active);
    if (steps == null && active == null) return json({ ok: false, message: "Keine Werte (steps / active) übergeben" }, 400);

    const cur = await db("docs?user_id=eq." + uid + "&id=eq.health&select=data");
    const data = (cur[0] && cur[0].data) || { days: {} };
    data.days = data.days || {};
    const prev = data.days[day] || {};
    data.days[day] = {
      steps: steps != null ? Math.round(steps) : prev.steps ?? null,
      active: active != null ? Math.round(active) : prev.active ?? null,
      t: Date.now(),
    };
    // nur die letzten 120 Tage behalten
    const keys = Object.keys(data.days).sort();
    while (keys.length > 120) delete data.days[keys.shift()!];
    data.upd = Date.now();
    await db("docs?on_conflict=user_id,id", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: uid, id: "health", data, updated_at: new Date().toISOString() }),
    });
    return json({ ok: true, day, ...data.days[day] });
  } catch (e) {
    return json({ ok: false, message: String(e) }, 500);
  }
});
