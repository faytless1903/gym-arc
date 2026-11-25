-- Gym Arc – Konten sperren (nur Besitzer)
-- Gesperrt = Anmeldung gesperrt (Supabase-Auth-Bann), alle Sitzungen beendet, kein Zugriff auf Daten (RLS), Claude aus.
-- (eingespielt am 25.11.2026 als Migration "block_accounts")

alter table public.app_access add column if not exists blocked boolean not null default false;

-- Ist das angemeldete Konto gesperrt?
create or replace function public.ga_blocked() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select a.blocked from public.app_access a where a.user_id = (select auth.uid())), false)
$$;

-- Gesperrte Konten kommen an keine Daten mehr – auch nicht mit einem noch gültigen Zugangsschlüssel
drop policy if exists "gesperrt" on public.docs;
create policy "gesperrt" on public.docs as restrictive for all to authenticated
  using (not (select public.ga_blocked())) with check (not (select public.ga_blocked()));

-- Sperren / entsperren
create or replace function public.ga_set_blocked(target uuid, block boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.ga_is_owner() then raise exception 'Nur für den Besitzer'; end if;
  if target = 'b489f427-ee44-495c-bdb4-858ae3c9773f'::uuid then raise exception 'Das eigene Konto kann nicht gesperrt werden'; end if;
  insert into public.app_access(user_id, allowed, blocked, updated_at)
  values (target, false, block, now())
  on conflict (user_id) do update set blocked = excluded.blocked, allowed = case when excluded.blocked then false else public.app_access.allowed end, updated_at = now();
  if block then
    update auth.users set banned_until = 'infinity' where id = target;
    delete from auth.sessions where user_id = target;   -- beendet alle Anmeldungen sofort (auch Refresh-Tokens)
    delete from public.push_subs where user_id = target;
    delete from public.push_timers where user_id = target;
  else
    update auth.users set banned_until = null where id = target;
  end if;
end $$;

-- Kontenliste mit Sperr-Status
drop function if exists public.ga_accounts();
create function public.ga_accounts()
returns table(user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, is_owner boolean,
  allowed boolean, monthly_limit_usd numeric, cost_month numeric, n_month bigint, cost_prev numeric, n_prev bigint, cost_total numeric, blocked boolean)
language plpgsql stable security definer set search_path = '' as $$
declare m timestamptz := date_trunc('month', now(), 'Europe/Berlin'); p timestamptz := date_trunc('month', now() - interval '1 month', 'Europe/Berlin');
begin
  if not public.ga_is_owner() then raise exception 'Nur für den Besitzer'; end if;
  return query
  select u.id, u.email::text, u.created_at, u.last_sign_in_at,
    u.id = 'b489f427-ee44-495c-bdb4-858ae3c9773f'::uuid,
    coalesce(a.allowed, false), coalesce(a.monthly_limit_usd, 2::numeric),
    coalesce(sum(c.cost_usd) filter (where c.created_at >= m), 0)::numeric,
    count(c.id) filter (where c.created_at >= m),
    coalesce(sum(c.cost_usd) filter (where c.created_at >= p and c.created_at < m), 0)::numeric,
    count(c.id) filter (where c.created_at >= p and c.created_at < m),
    coalesce(sum(c.cost_usd), 0)::numeric,
    coalesce(a.blocked, false)
  from auth.users u
  left join public.app_access a on a.user_id = u.id
  left join public.claude_usage c on c.user_id = u.id
  group by u.id, u.email, u.created_at, u.last_sign_in_at, a.allowed, a.monthly_limit_usd, a.blocked
  order by (u.id = 'b489f427-ee44-495c-bdb4-858ae3c9773f'::uuid) desc, u.created_at;
end $$;

-- Freigabe/Limit: gesperrte Konten nicht versehentlich wieder für Claude freigeben
create or replace function public.ga_set_access(target uuid, allow boolean, lim numeric default 2) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.ga_is_owner() then raise exception 'Nur für den Besitzer'; end if;
  insert into public.app_access(user_id, allowed, monthly_limit_usd, updated_at)
  values (target, allow, greatest(0, least(coalesce(lim, 2), 50)), now())
  on conflict (user_id) do update set allowed = excluded.allowed and not public.app_access.blocked, monthly_limit_usd = excluded.monthly_limit_usd, updated_at = now();
end $$;

revoke execute on function public.ga_blocked() from public, anon;
revoke execute on function public.ga_accounts() from public, anon;
revoke execute on function public.ga_set_blocked(uuid, boolean) from public, anon;
grant execute on function public.ga_blocked() to authenticated;
grant execute on function public.ga_accounts() to authenticated;
grant execute on function public.ga_set_blocked(uuid, boolean) to authenticated;
