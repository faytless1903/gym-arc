// Gym Arc – Server-Funktion "claude" (Supabase Edge Function)
// Leitet Anfragen der App an die Anthropic-API weiter. Der API-Schlüssel liegt nur hier als Secret.
// Benötigte Secrets: ANTHROPIC_API_KEY, ALLOWED_EMAIL (deine E-Mail; mehrere mit Komma trennen)
// Weitere Konten: Freigabe + Monatslimit in der Tabelle public.app_access (setzt der Besitzer in der App unter Einstellungen → Konten & Kosten)
// Optional: MODEL_QUICK, MODEL_DEFAULT (Modellnamen überschreiben)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Preise in US-Dollar pro 1 Mio. Tokens (Stand Nov. 2026, platform.claude.com/docs/en/about-claude/pricing)
const PRICES: Record<string, { in: number; out: number; inBig?: number; outBig?: number }> = {
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-haiku-5-5": { in: 0.10, out: 0.50, inBig: 0.50, outBig: 2.50 }, // über 100.000 Eingabe-Tokens teurer
};
function costUSD(model: string, u: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }) {
  const p = PRICES[model] || PRICES["claude-sonnet-5-5"];
  const inp = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  const big = inp > 100000 && p.inBig;
  return (inp * (big ? p.inBig! : p.in) + (u.output_tokens || 0) * (big ? p.outBig! : p.out)) / 1e6;
}
// Wofür war die Anfrage? (für die Liste in den Einstellungen – erkannt am Anfang des Auftrags)
const WHAT: [RegExp, string][] = [
  [/Kraftsport- und Ernährungscoach in der App/, "Coach-Chat"],
  [/Fortschrittsfotos/, "Fotovergleich"],
  [/Körperfettanteil/, "Körperfett per Foto"],
  [/Foto einer Mahlzeit/, "Essen per Foto"],
  [/beschreibt EIN Gericht/, "Essen per Beschreibung"],
  [/Ordne jedem Bestandteil|Bundeslebensmittelschlüssel/, "Nährwerte zuordnen (BLS)"],
  [/Zutaten eines Rezepts/, "Rezept-Zutaten zuordnen"],
  [/Webseiten-Text das Rezept/, "Rezept-Import per Link"],
  [/Auf dem Foto ist ein Rezept/, "Rezept per Foto"],
  [/Nährwerte für das GESAMTE Rezept/, "Rezept berechnen"],
  [/Beilage zu einer Mahlzeit/, "Beilage"],
  [/Ernährungscoach für einen Kraftsportler im Kaloriendefizit/, "Cut-Tipps"],
  [/gespeicherten Rezept in einer Ernährungs-App/, "Rezept-Chat"],
  [/Zubereitungsanleitung/, "Rezept-Anleitung"],
  [/Supermarkt-Abteilung/, "Einkaufsliste sortieren"],
  [/stagniert/, "Stagnation-Analyse"],
  [/Bewerte GENAU diese eine Übung/, "Übungs-Analyse"],
  [/Krafttrainings-Coach\. Analysiere die bisherigen Trainingsdaten/, "Trainingsempfehlungen"],
  [/Trainingsdokumentation|Mitschrift von Krafttrainings/, "Trainings-Import"],
  [/Nährwerttabelle|Nährwertangaben|Etikett/i, "Nährwerttabelle lesen"],
];
function whatOf(text: string, imgs: number) {
  for (const [re, l] of WHAT) if (re.test(text)) return l;
  return imgs ? "Foto-Analyse" : "Sonstiges";
}
async function logUsage(userId: string, model: string, u: Record<string, number>, what = "") {
  try {
    const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    await fetch(Deno.env.get("SUPABASE_URL") + "/rest/v1/claude_usage", {
      method: "POST",
      headers: { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: userId, model, input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0, cost_usd: costUSD(model, u), what: what || null }),
    });
  } catch (_) { /* Zählen darf nie die Antwort verhindern */ }
}

const OWNER_UID = "b489f427-ee44-495c-bdb4-858ae3c9773f";
// Monatsanfang in deutscher Zeit (wie die Übersicht in der App)
function monthStartBerlin() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = +parts.find((p) => p.type === "year")!.value, m = +parts.find((p) => p.type === "month")!.value;
  // 1. des Monats 00:00 Berlin = 23:00 bzw. 22:00 UTC am Vortag
  const guess = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const off = new Date(guess.toLocaleString("en-US", { timeZone: "Europe/Berlin" })).getTime() - new Date(guess.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(guess.getTime() - off);
}

const SYS_JSON =
  "Du bist der Assistent einer persönlichen Trainings- und Ernährungs-App. Antworte ausschließlich mit gültigem JSON genau im verlangten Format – ohne Erklärungen, ohne Markdown, ohne Codeblöcke.";
const SYS_TEXT = "Du bist der Assistent einer persönlichen Trainings- und Ernährungs-App. Antworte knapp auf Deutsch.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "method", message: "Nur POST" }, 405);
  try {
    // 1) Anmeldung prüfen: Besitzer immer, andere Konten nur mit Freigabe
    const auth = req.headers.get("Authorization") || "";
    const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const u = await fetch(Deno.env.get("SUPABASE_URL") + "/auth/v1/user", { headers: { Authorization: auth, apikey } });
    if (!u.ok) return json({ code: "not_granted", message: "Nicht angemeldet" }, 401);
    const user = await u.json();
    const allowed = (Deno.env.get("ALLOWED_EMAIL") || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    const isOwner = user.id === OWNER_UID || allowed.includes(String(user.email || "").toLowerCase());
    if (!isOwner) {
      // Andere Konten: nur mit Freigabe und innerhalb ihres Monatslimits
      const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const H = { apikey: SR, Authorization: "Bearer " + SR };
      const base = Deno.env.get("SUPABASE_URL") + "/rest/v1/";
      const ar = await fetch(base + "app_access?select=allowed,monthly_limit_usd&user_id=eq." + user.id, { headers: H });
      const acc = ar.ok ? (await ar.json())[0] : null;
      if (!acc || !acc.allowed) return json({ code: "not_granted", message: "Claude ist für dein Konto noch nicht freigeschaltet." }, 403);
      const start = monthStartBerlin().toISOString();
      const ur = await fetch(base + "claude_usage?select=cost_usd&user_id=eq." + user.id + "&created_at=gte." + encodeURIComponent(start), { headers: H });
      const spent = ur.ok ? (await ur.json()).reduce((a: number, x: { cost_usd: number }) => a + (+x.cost_usd || 0), 0) : 0;
      if (spent >= (+acc.monthly_limit_usd || 0)) {
        return json({ code: "rate_limited", message: "Monatslimit für Claude erreicht (" + (+acc.monthly_limit_usd).toFixed(2) + " $)." }, 429);
      }
    }

    // 2) Anfrage prüfen
    const b = await req.json();
    const images: { media_type: string; data: string }[] = Array.isArray(b.images) ? b.images : [];
    if (images.length > 4) return json({ code: "invalid", message: "Zu viele Bilder" }, 400);
    let messages: { role: string; content: unknown }[];
    if (Array.isArray(b.messages) && b.messages.length) {
      messages = b.messages.slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 60000),
      }));
    } else {
      messages = [{ role: "user", content: String(b.prompt || "").slice(0, 60000) }];
    }
    if (images.length) {
      const last = messages[messages.length - 1];
      last.content = [
        ...images.map((im) => ({
          type: "image",
          source: { type: "base64", media_type: im.media_type || "image/jpeg", data: im.data },
        })),
        { type: "text", text: String(last.content) },
      ];
    }
    const model = b.tier === "quick"
      ? (Deno.env.get("MODEL_QUICK") || "claude-haiku-5-5")
      : (Deno.env.get("MODEL_DEFAULT") || "claude-sonnet-5-5");

    // 3) Claude aufrufen
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens: 4096, system: b.json ? SYS_JSON : SYS_TEXT, messages }),
    });
    const d = await r.json();
    if (!r.ok) {
      const code = r.status === 429 || r.status === 529 ? "rate_limited" : "unavailable";
      return json({ code, message: (d && d.error && d.error.message) || "Claude-Fehler " + r.status }, r.status === 429 ? 429 : 502);
    }
    const first = Array.isArray(b.messages) && b.messages.length ? String(b.messages[0].content || "") : String(b.prompt || "");
    if (d.usage) await logUsage(user.id, model, d.usage, whatOf(first.slice(0, 3000), images.length));
    const text = (d.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    return json({ text, truncated: d.stop_reason === "max_tokens", model });
  } catch (e) {
    return json({ code: "unavailable", message: String(e) }, 500);
  }
});
