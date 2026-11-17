-- Gym Arc – Fortschrittsfotos und Apple-Health-Daten
-- SQL Editor → New query → alles einfügen → Run

-- 1) Privater Speicher für Fortschrittsfotos (jeder sieht nur seinen eigenen Ordner)
insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
  on conflict (id) do nothing;

drop policy if exists "fotos lesen"   on storage.objects;
drop policy if exists "fotos anlegen" on storage.objects;
drop policy if exists "fotos löschen" on storage.objects;
create policy "fotos lesen"   on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos anlegen" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2) Persönlicher Schlüssel für den Health-Kurzbefehl (nur die Server-Funktion liest ihn)
create table if not exists public.health_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token   text unique not null
);
alter table public.health_tokens enable row level security;
revoke all on public.health_tokens from anon, authenticated;
