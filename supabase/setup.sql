-- Gym Arc – Datenbank einrichten
-- In Supabase: SQL Editor → New query → alles einfügen → Run

create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Jeder sieht und ändert nur seine eigenen Daten
alter table public.docs enable row level security;

drop policy if exists "docs lesen"    on public.docs;
drop policy if exists "docs anlegen"  on public.docs;
drop policy if exists "docs ändern"   on public.docs;
drop policy if exists "docs löschen"  on public.docs;

create policy "docs lesen"   on public.docs for select to authenticated using (user_id = auth.uid());
create policy "docs anlegen" on public.docs for insert to authenticated with check (user_id = auth.uid());
create policy "docs ändern"  on public.docs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "docs löschen" on public.docs for delete to authenticated using (user_id = auth.uid());

revoke all on public.docs from anon;
grant select, insert, update, delete on public.docs to authenticated;
