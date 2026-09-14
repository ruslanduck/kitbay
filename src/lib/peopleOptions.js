// Who the people-pickers offer — read from the PEOPLE database, never a frozen
// list.
//
// Reported: a photographer added in People did not appear in the job form's
// picker. Three surfaces were asking three different questions — the Jobs
// screen merged people whose subcategory is exactly "Photographer" with a seed
// constant, while the calendar and the legacy shoot editor showed the constant
// ALONE — so whether a new person showed up depended on which door you came in.
//
// One rule now, and it is built so it cannot hide anyone:
//   1. the people whose trade says so, first;
//   2. then everyone else on the roster — an assistant shoots sometimes, and a
//      picker that refuses to offer a person you just filed reads as broken,
//      which is exactly what was reported;
//   3. then any name already written on a job that is not in the database at
//      all — the field has always taken free text, and dropping those would
//      make an existing job's own value unofferable.
//
// PURE: no React, no store, so `npm run test:lib` can hold the rule.
export function peopleNames(people = [], { role = null, used = [] } = {}) {
  const wanted = String(role ?? '')
    .trim()
    .toLowerCase()
  const nameOf = (p) => String(p?.name ?? '').trim()
  const live = (people ?? []).filter((p) => p && !p.archivedAt && nameOf(p))
  // A person's trade is their subcategory (Freelancer / Photographer); a model
  // is a category of its own (PEOPLE_CATEGORIES has Model with no second level).
  const matches = (p) =>
    !!wanted &&
    [p.subcategory, p.category].some((v) => String(v ?? '').trim().toLowerCase() === wanted)
  const byName = (a, b) => a.localeCompare(b)
  const first = live.filter(matches).map(nameOf).sort(byName)
  const rest = live.filter((p) => !matches(p)).map(nameOf).sort(byName)
  const typed = (used ?? [])
    .map((n) => String(n ?? '').trim())
    .filter(Boolean)
    .sort(byName)
  return [...new Set([...first, ...rest, ...typed])]
}
