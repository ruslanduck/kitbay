-- An ENDED session loses the data at once — not when its token runs out.
--
-- Supabase ends every session of an account when its password is changed (and on
-- sign-out), but an access token is a signed JWT that PostgREST accepts without
-- asking whether its session still exists. So a browser kept working on the old
-- token for up to an hour: measured 3 Oct, Clay Rodriguez had 0 rows in
-- auth.sessions right after his password was reset, while a tab signed in as him
-- reloaded and carried on. Every policy now also asks whether the token's session
-- is still alive, so a password change, a sign-out elsewhere or a revoked session
-- takes effect on the very next request.

-- 1. Is the caller's session still there? Supabase's user tokens name it in
--    `session_id`. FAIL-SAFE on purpose: a user token WITHOUT that claim (none is
--    expected — it would take an older auth server) passes as before rather than
--    locking the whole studio out; the worst case is a revocation that waits for
--    the token to expire, never an outage. The anon key and the service role have
--    no `sub`, so they never count as a member anyway.
create or replace function public.session_alive()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when auth.uid() is null then false
           when nullif(auth.jwt() ->> 'session_id', '') is null then true
           else exists (
             select 1
               from auth.sessions s
              where s.id = (auth.jwt() ->> 'session_id')::uuid
                and s.user_id = auth.uid()
                and (s.not_after is null or s.not_after > now())
           )
         end
$$;
revoke execute on function public.session_alive() from public, anon;
grant execute on function public.session_alive() to authenticated, service_role;

-- 2. The gate every policy already calls (20261003120000) now also requires it —
--    one place, so all 65 policies and the CV bucket follow without being touched.
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
     and public.session_alive()
$$;

-- 3. An account's OWN profile row stays readable to it (that is how the app can
--    say "not activated yet") — but only through a live session, so a dead token
--    reads nothing at all and the app sends it back to the sign-in screen.
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to authenticated
  using (
    (id = auth.uid() and (select public.session_alive()))
    or (select public.is_team_member())
  );
