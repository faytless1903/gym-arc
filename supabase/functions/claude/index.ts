// Gym Arc – Server-Funktion "claude" (Supabase Edge Function)
// Leitet Anfragen der App an die Anthropic-API weiter. Der API-Schlüssel liegt nur hier als Secret.
// Benötigte Secrets: ANTHROPIC_API_KEY, ALLOWED_EMAIL (deine E-Mail; mehrere mit Komma trennen)
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
async function logUsage(userId: string, model: string, u: Record<string, number>) {
  try {
    const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    await fetch(Deno.env.get("SUPABASE_URL") + "/rest/v1/claude_usage", {
      method: "POST",
      headers: { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: userId, model, input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0, cost_usd: costUSD(model, u) }),
    });
  } catch (_) { /* Zählen darf nie die Antwort verhindern */ }
}

const SYS_JSON =
  "Du bist der Assistent einer persönlichen Trainings- und Ernährungs-App. Antworte ausschließlich mit gültigem JSON genau im verlangten Format – ohne Erklärungen, ohne Markdown, ohne Codeblöcke.";
const SYS_TEXT = "Du bist der Assistent einer persönlichen Trainings- und Ernährungs-App. Antworte knapp auf Deutsch.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "method", message: "Nur POST" }, 405);
  try {
    // 1) Anmeldung prüfen: nur deine E-Mail darf Claude nutzen
    const auth = req.headers.get("Authorization") || "";
    const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const u = await fetch(Deno.env.get("SUPABASE_URL") + "/auth/v1/user", { headers: { Authorization: auth, apikey } });
    if (!u.ok) return json({ code: "not_granted", message: "Nicht angemeldet" }, 401);
    const user = await u.json();
    const allowed = (Deno.env.get("ALLOWED_EMAIL") || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    if (!allowed.length || !allowed.includes(String(user.email || "").toLowerCase())) {
      return json({ code: "not_granted", message: "Kein Zugriff" }, 403);
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
    if (d.usage) await logUsage(user.id, model, d.usage);
    const text = (d.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    return json({ text, truncated: d.stop_reason === "max_tokens", model });
  } catch (e) {
    return json({ code: "unavailable", message: String(e) }, 500);
  }
});
