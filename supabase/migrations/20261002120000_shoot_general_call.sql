-- A shoot's GENERAL CALL: one time for everyone, with no role and no person.
-- Asked for: "add a general call time for the shoot without needing to add
-- role/person. Sometimes everyone's call time is the same." Every call-sheet row
-- (roster_entries) needs a role, so a call for the whole crew had nowhere to go
-- but one row per role.
--
-- It sits beside `wrap_time` for the same reason: one time for the whole shoot
-- ("General crew call" on a call sheet). Rows may still carry their own times —
-- the exceptions (the producer earlier, the models later).
--
-- NOT a reuse of `start_time`: that column holds the 09:00 an order-created set
-- was once given without anyone typing it, and reading it back as "everyone is
-- called at 09:00" would be fabricated data. Null = no general call.
alter table public.sets add column if not exists call_time time;

comment on column public.sets.call_time is
  'General call for the whole shoot (everyone), HH:MM. Null = none; call-sheet rows carry their own.';
