// Super Intelligence — database API (Supabase via REST, service key stays server-side)
// POST /api/db  { op: "list" | "add" | "set" | "update" | "delete", col, id, data }
// Header: x-app-pin must match APP_PIN.

const COLS = new Set(["tracks", "visits", "tasks", "appts", "notes"]);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function pinOk(req) {
  const pin = process.env.APP_PIN;
  return !!pin && req.headers.get("x-app-pin") === pin;
}

function sb(path, init = {}) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY not set");
  const headers = { apikey: key, "content-type": "application/json", ...(init.headers || {}) };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`; // legacy JWT keys
  return fetch(`${url}/rest/v1/${path}`, { ...init, headers });
}

async function upsert(col, id, data) {
  const r = await sb("si_items", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ col, id, data, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(await r.text());
}

const q = (col, id) => `si_items?col=eq.${encodeURIComponent(col)}&id=eq.${encodeURIComponent(id)}`;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!pinOk(req)) return json({ code: "not_granted", error: "Wrong or missing PIN" }, 401);

  let b;
  try { b = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const { op, col, id, data } = b || {};
  if (op !== "list" && !COLS.has(col)) return json({ error: "Unknown collection" }, 400);

  try {
    if (op === "list") {
      const r = await sb("si_items?select=col,id,data&limit=10000");
      if (!r.ok) throw new Error(await r.text());
      return json({ items: await r.json() });
    }
    if (op === "add") {
      const newId = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
      await upsert(col, newId, data || {});
      return json({ id: newId });
    }
    if (!id) return json({ error: "Missing id" }, 400);
    if (op === "set") { await upsert(col, id, data || {}); return json({ ok: true }); }
    if (op === "update") {
      const r = await sb(`${q(col, id)}&select=data`);
      const cur = r.ok ? (await r.json())[0]?.data || {} : {};
      await upsert(col, id, { ...cur, ...(data || {}) });
      return json({ ok: true });
    }
    if (op === "delete") {
      const r = await sb(q(col, id), { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      return json({ ok: true });
    }
    return json({ error: "Unknown op" }, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
};

export const config = { path: "/api/db" };
