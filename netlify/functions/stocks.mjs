// Super Intelligence — US stock quotes (Yahoo Finance chart API, no key needed)
// POST /api/stocks { symbols: ["AAPL", ...] } -> { quotes: [{ symbol, name, price, prev, pct, currency, time }] }
// Header: x-app-pin must match APP_PIN. Delayed data, for information only.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function quote(sym) {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  for (const h of hosts) {
    try {
      const r = await fetch(`https://${h}/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; SuperIntelligence/1.0)" },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) continue;
      const m = (await r.json())?.chart?.result?.[0]?.meta;
      if (!m || m.regularMarketPrice == null) continue;
      const prev = m.chartPreviousClose ?? m.previousClose;
      const price = m.regularMarketPrice;
      return {
        symbol: m.symbol || sym,
        name: m.longName || m.shortName || "",
        price,
        prev,
        pct: prev ? ((price - prev) / prev) * 100 : 0,
        currency: m.currency || "USD",
        time: m.regularMarketTime || null,
      };
    } catch { /* try next host */ }
  }
  return { symbol: sym, error: "unavailable" };
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const pin = process.env.APP_PIN;
  if (!pin || req.headers.get("x-app-pin") !== pin) return json({ code: "not_granted", error: "Wrong or missing PIN" }, 401);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const symbols = [...new Set((b?.symbols || []).map((s) => String(s).toUpperCase().trim()))]
    .filter((s) => /^[A-Z.\-^]{1,10}$/.test(s))
    .slice(0, 12);
  if (!symbols.length) return json({ error: "No valid symbols" }, 400);
  return json({ quotes: await Promise.all(symbols.map(quote)) });
};

export const config = { path: "/api/stocks" };
