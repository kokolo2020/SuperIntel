-- Super Intelligence — run once in Supabase SQL Editor
create table if not exists public.si_items (
  col        text not null,           -- tracks | visits | tasks | appts | notes
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);

-- Lock the table: no public access. Only the Netlify function (service key) can read/write.
alter table public.si_items enable row level security;
revoke all on public.si_items from anon, authenticated;

-- Default rosters (rename in the app under Calendar → Rename rosters)
insert into public.si_items (col, id, data) values
  ('tracks','t1','{"label":"Nurse","order":1}'),
  ('tracks','t2','{"label":"OT","order":2}'),
  ('tracks','t3','{"label":"PT","order":3}')
on conflict do nothing;
