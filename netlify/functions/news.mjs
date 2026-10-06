// Super Intelligence — daily Khmer news for reading practice
// POST /api/news {} -> { items: [{ title, text, link, source, date }], via: "rss"|"gemini" }
// Header: x-app-pin must match APP_PIN. Tries Khmer RSS feeds first, then Gemini with Google Search.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Feeds are tried in parallel; any that fail are skipped. Override with env NEWS_FEEDS="name|url,name|url".
const DEFAULT_FEEDS = [
  ["Fresh News", "https://www.freshnewsasia.com/index.php/km/?format=feed&type=rss"],
  ["CamboJA", "https://cambojanews.com/km/feed/"],
  ["Khmer Times (KM)", "https://www.khmertimeskh.com/km/feed/"],
  ["Sabay", "https://news.sabay.com.kh/feed"],
  ["VOA Khmer", "https://khmer.voanews.com/api/zrqiteuuiq"],
  ["RFA Khmer", "https://www.rfa.org/khmer/rss2.xml"],
];
const feeds = process.env.NEWS_FEEDS
  ? process.env.NEWS_FEEDS.split(",").map((s) => s.split("|").map((x) => x.trim())).filter((x) => x[1])
  : DEFAULT_FEEDS;

const KM = /[ក-៿]/;
const strip = (s) => String(s || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/\s+/g, " ").trim();
const tag = (x, t) => (x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i")) || [])[1] || "";

async function readFeed([source, url]) {
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; SuperIntelligence/1.0)" }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return [];
    const xml = await r.text();
    const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi)].slice(0, 8).map((m) => {
      const x = m[0];
      const link = strip(tag(x, "link")) || (x.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || "";
      const body = strip(tag(x, "description") || tag(x, "summary") || tag(x, "content:encoded") || tag(x, "content"));
      return {
        title: strip(tag(x, "title")),
        text: body.slice(0, 900),
        link,
        source,
        date: strip(tag(x, "pubDate") || tag(x, "updated") || tag(x, "published")),
      };
    });
    return items.filter((i) => KM.test(i.title));
  } catch { return []; }
}

async function viaGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];
  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Today is ${today}. Use Google Search to find 8 of today's most important Cambodia news stories. Write each in clear, simple Khmer (ខ្មែរ) suitable for reading practice: a headline, then a 2-3 sentence summary. Output exactly one story per line in this format, nothing else:\nSOURCE || KHMER HEADLINE || KHMER SUMMARY || URL`;
  for (const model of [process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-flash-latest"]) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.3, maxOutputTokens: 3000 } }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) continue;
      const out = (await r.json()).candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      const items = out.split("\n").map((l) => l.split("||").map((s) => s.trim())).filter((p) => p.length >= 3 && KM.test(p[1]))
        .map((p) => ({ source: p[0].replace(/^[-*\d.\s]+/, ""), title: p[1], text: p[2], link: /^https?:/.test(p[3] || "") ? p[3] : "", date: today }));
      if (items.length) return items;
    } catch { /* try next model */ }
  }
  return [];
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const pin = process.env.APP_PIN;
  if (!pin || req.headers.get("x-app-pin") !== pin) return json({ code: "not_granted", error: "Wrong or missing PIN" }, 401);
  const lists = await Promise.all(feeds.map(readFeed));
  // interleave sources so one outlet doesn't dominate
  const rss = [];
  for (let i = 0; i < 8; i++) for (const l of lists) if (l[i]) rss.push(l[i]);
  if (rss.length >= 3) return json({ items: rss.slice(0, 20), via: "rss" });
  const g = await viaGemini();
  if (g.length) return json({ items: g, via: "gemini" });
  return json({ error: "Could not load Khmer news right now. Try again in a few minutes." }, 502);
};

export const config = { path: "/api/news" };
