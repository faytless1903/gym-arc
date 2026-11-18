// Gym Arc – Server-Funktion "recipe" (Supabase Edge Function)
// Lädt eine Rezept-Webseite (Link aus der App) und liest das Rezept aus den strukturierten Daten (schema.org/Recipe).
// Klappt das nicht, kommt der Seitentext zurück und die App lässt ihn von Claude auswerten.
// Verbraucht selbst keine Tokens.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const BASE = Deno.env.get("SUPABASE_URL") || "";

function blocked(u: URL) {
  const h = u.hostname.toLowerCase();
  if (!/^https?:$/.test(u.protocol)) return true;
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".supabase.co")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":")) return true; // keine IP-Adressen
  return false;
}
const decode = (s: string) => String(s || "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/\s+/g, " ").trim();

function findRecipe(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const x of node) { const r = findRecipe(x); if (r) return r; } return null; }
  const o = node as Record<string, unknown>;
  const t = o["@type"]; const types = Array.isArray(t) ? t : [t];
  if (types.some((x) => String(x).toLowerCase() === "recipe")) return o;
  for (const k of ["@graph", "mainEntity", "itemListElement", "item"]) { const r = findRecipe(o[k]); if (r) return r; }
  return null;
}
function steps(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === "string") return decode(v).split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9])/).filter(Boolean);
  if (Array.isArray(v)) return v.flatMap((x) => steps(x));
  const o = v as Record<string, unknown>;
  if (o.itemListElement) return steps(o.itemListElement);
  if (o.text) return [decode(String(o.text))];
  if (o.name) return [decode(String(o.name))];
  return [];
}
function servings(v: unknown): number | null {
  const s = Array.isArray(v) ? v.join(" ") : String(v ?? "");
  const m = s.match(/\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(",", ".")) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const u = await fetch(BASE + "/auth/v1/user", {
      headers: { Authorization: req.headers.get("Authorization") || "", apikey: req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "" },
    });
    if (!u.ok) return json({ code: "not_granted", message: "Nicht angemeldet" }, 401);
    const b = await req.json().catch(() => ({}));
    let url: URL;
    try { url = new URL(String(b.url || "").trim()); } catch (_) { return json({ code: "invalid", message: "Kein gültiger Link" }, 400); }
    if (blocked(url)) return json({ code: "invalid", message: "Dieser Link geht nicht" }, 400);

    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 12000);
    let html = "";
    try {
      const r = await fetch(url.toString(), {
        signal: ac.signal, redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Accept-Language": "de-DE,de;q=0.9" },
      });
      if (!r.ok) return json({ code: "unavailable", message: "Seite nicht erreichbar (" + r.status + ")" }, 502);
      html = (await r.text()).slice(0, 3_000_000);
    } finally { clearTimeout(tm); }

    for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      let data: unknown; try { data = JSON.parse(m[1].trim()); } catch (_) { continue; }
      const rc = findRecipe(data); if (!rc) continue;
      const ing = (Array.isArray(rc.recipeIngredient) ? rc.recipeIngredient : Array.isArray(rc.ingredients) ? rc.ingredients : [])
        .map((x: unknown) => decode(String(x))).filter(Boolean).slice(0, 60);
      if (!ing.length) continue;
      return json({
        ok: true, source: "schema",
        name: decode(String(rc.name || "")).slice(0, 80),
        servings: servings(rc.recipeYield),
        ingredients: ing,
        steps: steps(rc.recipeInstructions).slice(0, 40),
        url: url.toString(),
      });
    }
    // kein strukturiertes Rezept: Text der Seite für Claude
    const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const body = decode(html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")).slice(0, 14000);
    if (body.length < 200) return json({ code: "no_recipe", message: "Auf der Seite wurde kein Rezept gefunden" }, 422);
    return json({ ok: true, source: "text", title, text: body, url: url.toString() });
  } catch (e) {
    return json({ code: "unavailable", message: String(e && (e as Error).name === "AbortError" ? "Seite lädt zu lange" : e) }, 500);
  }
});
