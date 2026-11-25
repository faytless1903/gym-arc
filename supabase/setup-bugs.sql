-- Gym Arc – Fehlermeldungen aus der App (nur über die Server-Funktion "push" beschreibbar)
create table if not exists public.bug_reports (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  email      text,
  summary    text,
  data       jsonb not null,
  status     text not null default 'neu',
  created_at timestamptz not null default now()
);
alter table public.bug_reports enable row level security;
revoke all on public.bug_reports from anon, authenticated;
create index if not exists bug_reports_user_time on public.bug_reports (user_id, created_at);
