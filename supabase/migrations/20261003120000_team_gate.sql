-- Only ACTIVE team members reach the data (security audit, 3 Oct 2026).
--
-- Every policy in `public` was `to authenticated using (true)`, and three settings
-- on the hosted project turned "authenticated" into "anyone on the internet":
-- anonymous sign-ins were ON, self-registration was ON and email confirmation was
-- OFF. The anon key is public by design (it ships in the bundle), so a direct
-- `signInAnonymously()` or `signUp()` handed out an `authenticated` JWT — and with
-- it read/write on every job, person, company and item.
--
-- The dashboard settings are being closed too, but the DATABASE must not depend on
-- them. From here on a new auth user — anonymous, self-registered or issued by the
-- studio — gets an INACTIVE profile and sees nothing until `profiles.active` is
-- set, which only the service role can do (`npm run user:add` does it).

-- 1. The flag. Everyone already on the team keeps access: the existing profiles
--    are the studio's own accounts (an anonymous auth user never had one).
alter table public.profiles add column if not exists active boolean not null default false;
update public.profiles p
   set active = true
  from auth.users u
 where u.id = p.id
   and not coalesce(u.is_anonymous, false);

-- 2. The one question every policy asks. SECURITY DEFINER so it can read
--    `profiles` from inside the policies OF `profiles` without recursing; it only
--    ever answers about the caller.
create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1
             from public.profiles p
            where p.id = auth.uid()
              and p.active
         )
     and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;
revoke execute on function public.is_team_member() from public, anon;
grant execute on function public.is_team_member() to authenticated, service_role;

-- 3. A new user's role is ours to set, never the signer's: reading `role` from
--    raw_user_meta_data let anyone calling signUp() pick their own. And a new
--    profile starts inactive.
create or replace function public.fn_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, email, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'equipment_team',
    new.email,
    false
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- 4. profiles. A member reads the whole team (every "created by" resolves a
--    name); anyone signed in reads only their OWN row, so the app can say "not
--    activated yet" instead of showing an empty studio. Nothing in the app ever
--    updated a profile, so the update policy goes: it let a user rewrite their own
--    `role`, and would now let them switch themselves on.
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_read_auth" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to authenticated
  using (id = auth.uid() or (select public.is_team_member()));

-- 5. Every other policy in `public`: whatever it already required, AND an active
--    member. Rewritten in place rather than dropped and recreated, so each keeps
--    its name, command and role. `(select …)` makes Postgres evaluate the check
--    once per statement instead of once per row.
--    ⚠️ A table added later needs the same gate in its own policies.
do $$
declare
  p record;
  gate constant text := '(select public.is_team_member())';
  q text;
  c text;
begin
  for p in
    select tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and tablename <> 'profiles'
  loop
    q := case
           when p.qual is null then null
           when p.qual like '%is_team_member%' then null
           when p.qual = 'true' then gate
           else format('(%s) and %s', p.qual, gate)
         end;
    c := case
           when p.with_check is null then null
           when p.with_check like '%is_team_member%' then null
           when p.with_check = 'true' then gate
           else format('(%s) and %s', p.with_check, gate)
         end;
    if q is not null and c is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)', p.policyname, p.tablename, q, c);
    elsif q is not null then
      execute format('alter policy %I on public.%I using (%s)', p.policyname, p.tablename, q);
    elsif c is not null then
      execute format('alter policy %I on public.%I with check (%s)', p.policyname, p.tablename, c);
    end if;
  end loop;
end $$;

-- 6. Trigger functions are not an API. EXECUTE was granted to PUBLIC by default,
--    which put all three on the RPC surface (Supabase advisor). A trigger fires
--    without it — checked on prod, in a rolled-back transaction, before this was
--    written: a SECURITY DEFINER trigger function with EXECUTE revoked from
--    `authenticated` still ran on that role's INSERT.
revoke execute on function public.fn_handle_new_user() from public, anon, authenticated;
revoke execute on function public.fn_log_set_unit_change() from public, anon, authenticated;
revoke execute on function public.fn_stamp_repair_return() from public, anon, authenticated;
