-- Mailing list for reecemusic.com on Vercel (applied to the breadywebstudios Supabase project).
create table if not exists public.reece_subscribers (
  id bigint generated always as identity primary key,
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  source text not null default 'website' check (length(source) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reece_subscribers enable row level security; -- no policies: not readable with public keys

create or replace function public.reece_subscribe(p_email text, p_source text default 'website')
returns boolean language plpgsql security definer set search_path = public as $$
declare v_new boolean;
begin
  insert into public.reece_subscribers (email, source)
  values (lower(trim(p_email)), coalesce(nullif(regexp_replace(coalesce(p_source, ''), '[^a-zA-Z0-9_-]', '', 'g'), ''), 'website'))
  on conflict (email) do update set source = excluded.source, updated_at = now()
  returning (xmax = 0) into v_new;
  return v_new;  -- true = new subscriber
end; $$;

revoke all on function public.reece_subscribe(text, text) from public, anon, authenticated;
grant execute on function public.reece_subscribe(text, text) to service_role;
