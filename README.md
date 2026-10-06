# Super Intelligence

Daily dashboard for iPad: who's on duty (Nurse / OT / PT rosters), tasks, appointments, visit notes, AI daily briefing (read aloud), plain-language quick add.

**Stack:** static page (`public/`) + Netlify Functions + Supabase + Gemini. No build step.

## Setup

1. **Supabase** → SQL Editor → run `supabase/schema.sql`.
2. **Netlify** → Add new site → Import from GitHub → `kokolo2020/SuperIntel` (build settings come from `netlify.toml`).
3. **Netlify → Site configuration → Environment variables:**

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | `https://<project>.supabase.co` |
   | `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role / secret key |
   | `GEMINI_API_KEY` | Google AI Studio key |
   | `APP_PIN` | any PIN you choose (asked once per device) |
   | `GEMINI_MODEL` | optional, default `gemini-2.5-flash` |

4. Redeploy. Open the site on the iPad → enter PIN → Share → **Add to Home Screen**.

## How it works

- `public/index.html`: the whole UI. Refreshes every 30 s and when reopened.
- `netlify/functions/db.mjs` → `/api/db`: reads/writes the `si_items` table with the service key. Table has RLS on and no public access.
- `netlify/functions/ai.mjs` → `/api/ai`: calls Gemini. Keys never reach the browser.
- Both functions require the `x-app-pin` header to match `APP_PIN`.
