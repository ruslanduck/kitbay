-- A job's ASSIGNEES — several people, not one. Asked: the client's ticket said
-- "Photographer → add all crew", so the field has to take more than one person.
--
-- Until now `orders.photographer_contact_id` held ONE person: it named the
-- photographer when that was the only person a job carried, then became the
-- single Assignee. A list needs its own rows.
--
-- One row per person on the job, in the order they were picked. These rows are
-- the CONTENTS of a job, like its order_lines: replaced wholesale on save, so
-- the table keeps DELETE (the archive-not-delete rule covers records with an
-- identity and a card of their own, which an assignment has not).
--
-- `orders.photographer_contact_id` is KEPT and written as the FIRST assignee, so
-- a reader that only knows the column — a tab still running yesterday's bundle —
-- still sees somebody, and so the backfill below has its source.

create table if not exists public.order_assignees (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  -- RESTRICT like roster_entries: people are archived, never deleted, and an
  -- assignment must not vanish because someone tidied People.
  contact_id  uuid not null references public.contacts(id) on delete restrict,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references public.profiles(id) on delete set null,
  -- One person once per job; the app folds a name typed twice before writing.
  unique (order_id, contact_id)
);

-- A person's card lists every job they are on (getPeople embeds this table).
create index if not exists order_assignees_contact_idx on public.order_assignees (contact_id);

alter table public.order_assignees enable row level security;
create policy "auth_read_order_assignees"  on public.order_assignees for select to authenticated using (true);
create policy "auth_write_order_assignees" on public.order_assignees for all    to authenticated using (true) with check (true);

-- Every job that has an assignee keeps them, as its first.
insert into public.order_assignees (order_id, contact_id, position)
select id, photographer_contact_id, 0
from public.orders
where photographer_contact_id is not null
on conflict (order_id, contact_id) do nothing;

comment on table public.order_assignees is
  'The people a job is assigned to, in the order picked. orders.photographer_contact_id mirrors the first.';
