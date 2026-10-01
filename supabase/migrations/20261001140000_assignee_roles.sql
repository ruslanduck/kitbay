-- Each assignee carries their ROLE on the job: the job's crew reads as a list
-- "Marcus Reed (Photographer)", which is how the studio asked to see it ("много
-- людей … в формате имя (роль)"). Free text like the call sheet's roles: the
-- picker offers the call sheet's list plus Other, with the role typed beside it.
alter table public.order_assignees add column if not exists role text;

-- Every assignment made before roles existed starts from the person's own trade,
-- the same default the form gives a new pick: their subcategory, or Model (a
-- category with no second level). Nobody's trade is invented — without one the
-- role stays empty and the person reads by name alone.
update public.order_assignees a
   set role = coalesce(nullif(btrim(c.subcategory), ''), case when c.category = 'Model' then 'Model' end)
  from public.contacts c
 where c.id = a.contact_id
   and a.role is null;

comment on column public.order_assignees.role is
  'The person''s role on this job (free text, e.g. Photographer). Null = not given.';
