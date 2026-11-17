-- Gym Arc – Mitteilungen bei Pausenende
-- Projekt-Adresse ist bereits eingetragen.
-- Dann: SQL Editor → New query → alles einfügen → Run

create table if not exists public.push_subs (
  endpoint   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  sub        jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.push_timers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  due_at  timestamptz not null,
  title   text,
  body    text
);
create table if not exists public.push_keys (
  id   int primary key default 1,
  pub  text  not null,
  priv jsonb not null
);
-- Nur die Server-Funktion darf diese Tabellen lesen/schreiben
alter table public.push_subs   enable row level security;
alter table public.push_timers enable row level security;
alter table public.push_keys   enable row level security;
revoke all on public.push_subs, public.push_timers, public.push_keys from anon, authenticated;
create index if not exists push_timers_due on public.push_timers (due_at);

-- Zeitplaner: alle 2 Sekunden prüfen, ob eine Pause vorbei ist (ruft die Funktion nur dann auf)
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname in ('gym-arc-push', 'gym-arc-push-cleanup');

select cron.schedule('gym-arc-push-cleanup', '17 * * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '1 hour' $$);

select cron.schedule('gym-arc-push', '2 seconds', $$
  select net.http_post(
    url     := 'https://deutodqxafjzrsnqqszg.supabase.co/functions/v1/push',
    body    := '{"action":"tick"}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb
  ) where exists (select 1 from public.push_timers where due_at <= now() + interval '1 second');
$$);
