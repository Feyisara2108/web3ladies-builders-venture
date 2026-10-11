-- Self-serve cohort join links. Admins generate a link per cohort;
-- anyone with the link can create their own student account for that
-- cohort via the join-cohort Edge Function (which validates the token
-- server-side with the service_role key — this table itself stays
-- admin-only, nothing here is publicly readable).

create extension if not exists pgcrypto with schema extensions;

create table public.cohort_invite_links (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  expires_at timestamptz not null default (now() + interval '30 days'),
  max_uses integer,
  use_count integer not null default 0,
  revoked boolean not null default false,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

create index on public.cohort_invite_links (token);
create index on public.cohort_invite_links (cohort_id);

alter table public.cohort_invite_links enable row level security;

create policy "cohort_invite_links_admin_all" on public.cohort_invite_links
  for all using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ============================================================
-- Narrow public lookup: given a token, reveal only the cohort name
-- and whether the link is currently valid — nothing else about the
-- row (no admin/id/usage data leaks to unauthenticated callers).
-- ============================================================

create function public.get_cohort_invite_info(p_token text)
returns table (cohort_name text, valid boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.name,
    (l.id is not null
      and not l.revoked
      and l.expires_at > now()
      and (l.max_uses is null or l.use_count < l.max_uses)
    ) as valid
  from public.cohort_invite_links l
  join public.cohorts c on c.id = l.cohort_id
  where l.token = p_token;
$$;

grant execute on function public.get_cohort_invite_info(text) to anon, authenticated;
