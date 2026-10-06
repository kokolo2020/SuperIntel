// Super Intelligence — Gemini proxy (API key stays server-side)
// POST /api/ai  { prompt, json?: boolean }  ->  { text }
// Header: x-app-pin must match APP_PIN.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const pin = process.env.APP_PIN;
  if (!pin || req.headers.get("x-app-pin") !== pin) return json({ code: "not_granted", error: "Wrong or missing PIN" }, 401);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  let b;
  try { b = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const prompt = String(b?.prompt || "").slice(0, 60000);
  if (!prompt) return json({ error: "Missing prompt" }, 400);

  // Try the preferred model first, then fall back if Google says it is overloaded or unavailable.
  const models = [...new Set([model, "gemini-flash-latest", "gemini-flash-lite-latest"])];
  let r, j = {};
  for (const m of models) {
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: b.json ? { responseMimeType: "application/json" } : {},
        }),
        signal: AbortSignal.timeout(7000),
      });
      j = await r.json().catch(() => ({}));
      if (r.ok) break;
      if (![404, 429, 500, 503, 504].includes(r.status)) break; // real error (bad key, billing): do not retry
    } catch { r = null; j = { error: { message: "Gemini timed out" } }; }
  }
  if (!r || !r.ok) return json({ code: r?.status === 429 ? "rate_limited" : "error", error: j.error?.message || "Gemini error" }, 502);

  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!text) return json({ code: "refused", error: "Empty answer" }, 502);
  return json({ text });
};

export const config = { path: "/api/ai" };
