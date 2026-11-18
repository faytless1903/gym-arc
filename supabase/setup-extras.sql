-- Gym Arc – Wiege-Erinnerung (6:55) und tägliche Sicherung
-- SQL Editor → New query → alles einfügen → Run   (verbraucht keine Claude-Tokens)

-- 1) Wiege-Erinnerung
create table if not exists public.push_daily (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weigh   boolean not null default true
);
alter table public.push_daily enable row level security;
revoke all on public.push_daily from anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('gym-arc-morning', 'gym-arc-backup');

-- 4:55 und 5:55 UTC = 6:55 in Berlin (Winter- bzw. Sommerzeit); die Funktion prüft die Berliner Uhrzeit selbst
select cron.schedule('gym-arc-morning', '55 4,5 * * *', $$
  select net.http_post(
    url     := 'https://deutodqxafjzrsnqqszg.supabase.co/functions/v1/push',
    body    := '{"action":"morning"}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
$$);

-- 2) Tägliche Sicherung um 3:15 (Berlin ca. 4:15), 30 Tage aufbewahrt
create table if not exists public.docs_backup (
  day        date        not null,
  user_id    uuid        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz,
  primary key (day, user_id, id)
);
alter table public.docs_backup enable row level security;
revoke all on public.docs_backup from anon, authenticated;

select cron.schedule('gym-arc-backup', '15 2 * * *', $$
  insert into public.docs_backup (day, user_id, id, data, updated_at)
    select current_date, user_id, id, data, updated_at from public.docs
    on conflict do nothing;
  delete from public.docs_backup where day < current_date - 30;
$$);

-- gleich die erste Sicherung anlegen
insert into public.docs_backup (day, user_id, id, data, updated_at)
  select current_date, user_id, id, data, updated_at from public.docs
  on conflict do nothing;

-- Eiweiß-Erinnerung um 20:00 (Berlin)
alter table public.push_daily add column if not exists protein boolean not null default false;
alter table public.push_daily add column if not exists p_goal integer not null default 0;
select cron.schedule('gym-arc-evening', '0 18,19 * * *', $$
  select net.http_post(
    url     := 'https://deutodqxafjzrsnqqszg.supabase.co/functions/v1/push',
    body    := '{"action":"evening"}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
$$);
