-- One call sheet: every row is a TIME · ROLE · PERSON.
--
-- Until now a shoot kept two lists describing the same people from two ends:
-- `set_call_times` (a time + the roles it applies to, no names) and
-- `roster_entries` (a person + a role, no time). The studio asked for ONE block
-- — "10:00 · Producer · Clay Rodriguez" — with the photographer just one of its
-- rows, one role and one person per row, the person picked from People or typed.
--
-- The roster is the table that already links people to shoots (a person's work
-- history reads it), so IT becomes the call sheet: it gains the call time, a
-- note and an order, and a row may name a role before anyone is booked for it.
--
-- `set_call_times` is left in place and no longer read — nothing in this app
-- deletes data. Its rows are carried over below.

alter table public.roster_entries alter column contact_id drop not null;
alter table public.roster_entries add column if not exists call_time time;
alter table public.roster_entries add column if not exists note text;
alter table public.roster_entries add column if not exists position integer not null default 0;

-- The old uniqueness (one role per person per shoot) doesn't describe a call
-- sheet: a person can be called twice (a morning and an afternoon call), and
-- several rows can wait for a person in the same role. The app normalises a
-- sheet before writing it, so an exact duplicate never reaches the table. The
-- constraint was declared inline, so its generated name is looked up rather
-- than guessed.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.roster_entries'::regclass and contype = 'u'
  loop
    execute format('alter table public.roster_entries drop constraint %I', c.conname);
  end loop;
end $$;

-- A row IS a role on a shoot; the person and the time are optional.
alter table public.roster_entries drop constraint if exists roster_entries_role_not_blank;
alter table public.roster_entries
  add constraint roster_entries_role_not_blank check (btrim(role) <> '');

-- The roster spoke lowercase ('photographer'); the call sheet speaks the role
-- list's own words ('Photographer'). One vocabulary, so a call for the
-- Photographer finds the photographer's row below.
update public.roster_entries set role = 'Photographer' where role = 'photographer';
update public.roster_entries set role = 'Model' where role = 'model';

-- Carry every existing call over. Each ROLE of a call becomes a row. If the
-- shoot already has a row with that role and no time yet (the photographer or
-- model it was always about), the time and the note join THAT row; otherwise
-- it is a new row with nobody named yet — unless an identical row is already
-- there (prod carried "08:15 Producer" twice for one shoot). The same rule is
-- `crewFromLegacy` in src/lib/crew.js, which builds the demo seed.
do $$
declare
  c record;
  r text;
  target uuid;
begin
  for c in
    select set_id, roles, call_time, note
    from public.set_call_times
    order by set_id, call_time, position
  loop
    foreach r in array c.roles loop
      continue when btrim(coalesce(r, '')) = '';
      select id into target
      from public.roster_entries
      where set_id = c.set_id and lower(role) = lower(btrim(r)) and call_time is null
      order by created_at, id
      limit 1;
      if target is not null then
        update public.roster_entries
          set call_time = c.call_time, note = coalesce(note, c.note), role = btrim(r)
          where id = target;
      elsif not exists (
        select 1 from public.roster_entries
        where set_id = c.set_id
          and lower(role) = lower(btrim(r))
          and call_time = c.call_time
          and contact_id is null
          and coalesce(note, '') = coalesce(c.note, '')
      ) then
        insert into public.roster_entries (set_id, contact_id, role, call_time, note)
        values (c.set_id, null, btrim(r), c.call_time, c.note);
      end if;
    end loop;
  end loop;
end $$;

-- The day in order: timed rows by time, the rest after them as they were made.
update public.roster_entries re
set position = x.pos
from (
  select id,
         (row_number() over (partition by set_id order by call_time nulls last, created_at, id) - 1)::int as pos
  from public.roster_entries
) x
where re.id = x.id;

comment on column public.roster_entries.call_time is
  'When this person / role is called on the shoot. Null = on the crew, no call yet.';
comment on column public.roster_entries.contact_id is
  'The person (People). Null = a role listed before anyone is booked for it.';
comment on table public.set_call_times is
  'LEGACY — superseded by roster_entries.call_time (20260930120000). Kept, unread.';
