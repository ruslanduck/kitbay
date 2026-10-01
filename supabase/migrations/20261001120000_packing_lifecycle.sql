-- Packing list lifecycle: check-out and check-in, each with WHO and WHEN.
--
-- The digital packing list and its PDF now carry two moments per row: the
-- piece is CHECKED OUT when it is placed in the studio and CHECKED IN when it
-- comes back (by a tap, or by scanning its barcode / QR). Both record the
-- staff member's name and the date/time automatically.
--
-- The moments live in the slots `packing_signoffs` has had since 20260803:
-- `out1` (until now the single "packed" tick — so every existing tick reads as
-- a check-out) and `ret`, which the table carried from the start and nothing
-- wrote. The two columns per slot held initials + timestamp; the ticket asks
-- for the NAME, so each slot gains one, and the return records HOW it was
-- taken (a scan proves the physical piece was in hand).
--
-- Nothing is dropped or rewritten: the initials columns stay as the record of
-- the three-field era, and old rows read back unchanged.
alter table public.packing_signoffs
  add column if not exists out1_name text,
  add column if not exists ret_name  text,
  add column if not exists ret_via   text
    check (ret_via is null or ret_via in ('manual', 'scan'));

comment on column public.packing_signoffs.out1_name is
  'Who checked the piece out (the signed-in account''s name), beside the legacy initials.';
comment on column public.packing_signoffs.ret_name is
  'Who checked the piece back in.';
comment on column public.packing_signoffs.ret_via is
  'How the check-in was recorded: manual (a tap) or scan (the barcode / QR was read).';
