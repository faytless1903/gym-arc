-- Gym Arc – Claude-Verbrauch mitzählen
-- SQL Editor → New query → einfügen → Run

create table if not exists public.claude_usage (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  model         text,
  input_tokens  int,
  output_tokens int,
  cost_usd      numeric(10,6)
);
create index if not exists claude_usage_user_time on public.claude_usage (user_id, created_at);

alter table public.claude_usage enable row level security;
drop policy if exists "verbrauch lesen" on public.claude_usage;
create policy "verbrauch lesen" on public.claude_usage for select to authenticated using (user_id = auth.uid());
revoke all on public.claude_usage from anon;
grant select on public.claude_usage to authenticated;

-- Wofür eine Claude-Anfrage war (Liste in den Einstellungen)
alter table public.claude_usage add column if not exists what text;
