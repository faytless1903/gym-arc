-- Gym Arc – mehrere Konten: Claude-Freigabe + Monatslimit je Konto, Kostenübersicht für den Besitzer
-- (bereits eingespielt am 25.11.2026 als Migration "multi_account_access")

create table if not exists public.app_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  allowed boolean not null default false,
  monthly_limit_usd numeric(10,2) not null default 2,
  updated_at timestamptz not null default now()
);
alter table public.app_access enable row level security;
revoke all on public.app_access from anon, authenticated;
grant select on public.app_access to authenticated;
drop policy if exists "zugriff lesen" on public.app_access;
create policy "zugriff lesen" on public.app_access for select to authenticated using (user_id = (select auth.uid()));

-- Besitzer = dein Supabase-Konto
create or replace function public.ga_is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.uid()) = 'b489f427-ee44-495c-bdb4-858ae3c9773f'::uuid, false)
$$;

-- Alle Konten mit Claude-Kosten (dieser Monat, Vormonat, gesamt) – nur für den Besitzer
create or replace function public.ga_accounts()
returns table(user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, is_owner boolean,
  allowed boolean, monthly_limit_usd numeric, cost_month numeric, n_month bigint, cost_prev numeric, n_prev bigint, cost_total numeric)
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
    coalesce(sum(c.cost_usd), 0)::numeric
  from auth.users u
  left join public.app_access a on a.user_id = u.id
  left join public.claude_usage c on c.user_id = u.id
  group by u.id, u.email, u.created_at, u.last_sign_in_at, a.allowed, a.monthly_limit_usd
  order by (u.id = 'b489f427-ee44-495c-bdb4-858ae3c9773f'::uuid) desc, u.created_at;
end $$;

-- Freigabe/Limit setzen – nur für den Besitzer
create or replace function public.ga_set_access(target uuid, allow boolean, lim numeric default 2) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.ga_is_owner() then raise exception 'Nur für den Besitzer'; end if;
  insert into public.app_access(user_id, allowed, monthly_limit_usd, updated_at)
  values (target, allow, greatest(0, least(coalesce(lim, 2), 50)), now())
  on conflict (user_id) do update set allowed = excluded.allowed, monthly_limit_usd = excluded.monthly_limit_usd, updated_at = now();
end $$;

revoke execute on function public.ga_is_owner() from public, anon;
revoke execute on function public.ga_accounts() from public, anon;
revoke execute on function public.ga_set_access(uuid, boolean, numeric) from public, anon;
grant execute on function public.ga_is_owner() to authenticated;
grant execute on function public.ga_accounts() to authenticated;
grant execute on function public.ga_set_access(uuid, boolean, numeric) to authenticated;
