// Super Intelligence — YouTube search (optional; needs YOUTUBE_API_KEY from Google Cloud, YouTube Data API v3)
// POST /api/yt { q } -> { id, title }
// Header: x-app-pin must match APP_PIN.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const pin = process.env.APP_PIN;
  if (!pin || req.headers.get("x-app-pin") !== pin) return json({ code: "not_granted", error: "Wrong or missing PIN" }, 401);
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return json({ code: "no_key", error: "YOUTUBE_API_KEY not set" }, 501);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const q = String(b?.q || "").slice(0, 200);
  if (!q) return json({ error: "Missing query" }, 400);
  const r = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=1&q=${encodeURIComponent(q)}&key=${key}`,
  );
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: j.error?.message || "YouTube error" }, 502);
  const it = j.items?.[0];
  if (!it) return json({ error: "No results" }, 404);
  return json({ id: it.id.videoId, title: it.snippet.title });
};

export const config = { path: "/api/yt" };
