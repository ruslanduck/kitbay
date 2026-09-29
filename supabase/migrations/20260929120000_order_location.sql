-- Where a LOCATION shoot happens.
--
-- The sixth calendar row, "L", was always the studio's name for shooting
-- somewhere other than its own rooms — Pier 59 / Studio 101, a client's office,
-- a street. The app could book a job there and had nowhere to write WHERE, so
-- the crew kept the address in their heads or in the job name.
--
-- Free text (venue, room, street address in whatever words the crew uses), and
-- written only while the job is booked on L: a job in studios 1-5 leaves it
-- null, and moving a job off L clears it, so a stale address can never ride
-- along on a studio shoot.
--
-- On `orders`, not `sets`, for the same reason as `set_label`: a job that has
-- no shoot row of its own must not silently drop what was typed.
alter table public.orders add column if not exists location text;

comment on column public.orders.location is
  'Free-text venue and address of a LOCATION shoot (studio_id = ''L''). Null for studios 1-5.';
