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
// What a person DOES, as People files it: their trade (the subcategory), or
// Model, which is a category with no second level. A person put on a job starts
// with it as their role there, and every picker shows it beside the name.
export function personTrade(person) {
  const sub = String(person?.subcategory ?? '').trim()
  if (sub) return sub
  return String(person?.category ?? '').trim() === 'Model' ? 'Model' : null
}

// A job's ASSIGNEES, tidied: each one `{ name, role }`, a name kept once (first
// spelling wins), blanks dropped. Plain names are accepted too — a job saved
// before roles existed holds strings.
export function normalizeAssignees(list = []) {
  const seen = new Set()
  const out = []
  for (const raw of list ?? []) {
    const a = typeof raw === 'string' ? { name: raw, role: null } : raw || {}
    const name = String(a.name ?? '').trim()
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push({ name, role: String(a.role ?? '').trim() || null })
  }
  return out
}

// How a person on a job reads everywhere: "Marcus Reed (Photographer)" — the
// format asked for — or just the name when nobody gave them a role.
export const assigneeLabel = (a) => {
  const [one] = normalizeAssignees([a])
  if (!one) return ''
  return one.role ? `${one.name} (${one.role})` : one.name
}
export const assigneeNames = (list) => normalizeAssignees(list).map((a) => a.name)

// A list of typed names, tidied: trimmed, blanks dropped, and a name typed
// twice (in any case) kept once, first spelling wins.
export function uniqueNames(names = []) {
  const seen = new Set()
  const out = []
  for (const raw of names ?? []) {
    const name = String(raw ?? '').trim()
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push(name)
  }
  return out
}

// Which TRADES the People filter offers, given the category it is narrowed to.
//
// A person's category is Freelancer / Model / Rental company / Agency and their
// SUBCATEGORY is the trade — Photographer, Stylist, Booker. Nobody looks someone
// up by the first one: the question is always "who are the photographers", which
// is why a filter offering only categories could not answer it at all.
//
// Built from the ROSTER, so every option matches somebody (the empty-dropdown
// lesson from `brandsIn`). `categories` supplies the ORDER — the taxonomy's own,
// not alphabetical — and a trade the register carries but the taxonomy does not
// is appended rather than dropped: the person editor takes free text wherever a
// category has no list of its own.
export function subcategoriesIn(people = [], category = 'All', categories = {}) {
  const pool =
    category && category !== 'All'
      ? people.filter((p) => p?.category === category)
      : people
  const present = new Set(pool.map((p) => p?.subcategory).filter(Boolean))
  const known = [...new Set(Object.values(categories).flat())].filter((sub) => present.has(sub))
  const extra = [...present]
    .filter((sub) => !known.includes(sub))
    .sort((a, b) => a.localeCompare(b))
  return [...known, ...extra]
}
