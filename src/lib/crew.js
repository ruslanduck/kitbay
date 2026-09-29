// The call sheet, the way the studio asked for it: every row is a TIME · ROLE ·
// PERSON — "10:00 · Producer · Clay Rodriguez". One role and one person per row,
// and the photographer is simply one of the rows.
//
// It replaced TWO lists that described the same people from two ends: call times
// (a time + the roles it applies to, no names) and the roster (a person + a role,
// no time). A row always names its ROLE; the time and the person are optional —
// a role can be listed before anyone is booked, and a person can be on the crew
// before their call is set.
//
// PURE — no React, no store — so `npm run test:lib` holds the rules.
import { isValidTime, toHHMM, CALL_ROLES } from './callTimes.js'

const clean = (s) => String(s ?? '').trim()
const same = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase()

// A row as the app holds it. `contactId` is the person in People when the row
// was read from the database; a changed name drops it (the form does that), so
// the write resolves the name again.
export function crewRow(r = {}, i = 0) {
  const time = toHHMM(r?.time)
  return {
    id: r?.id ?? null,
    role: clean(r?.role),
    name: clean(r?.name) || null,
    contactId: r?.contactId ?? null,
    time: isValidTime(time) ? time : null,
    note: clean(r?.note) || null,
    position: Number.isFinite(r?.position) ? r.position : i,
  }
}

// Tidy what a form or the database hands in: a row with no role is dropped (the
// form refuses to save one with anything else in it, so this only ever drops an
// empty row), the day is put in order — timed rows by time, untimed ones after
// them in the order they were typed — and an exact duplicate folds into one.
export function normalizeCrew(rows = []) {
  // Compared as plain strings (HH:MM sorts correctly), NOT with localeCompare:
  // collation puts punctuation before digits, which once sorted an untimed row
  // (keyed '~') to the TOP of the day. The test suite caught it.
  const byTime = (a, b) => {
    if (a.time === b.time) return a.position - b.position
    if (!a.time) return 1
    if (!b.time) return -1
    return a.time < b.time ? -1 : 1
  }
  const tidy = (rows || [])
    .map(crewRow)
    .filter((r) => r.role)
    .sort(byTime)
  const seen = new Set()
  const out = []
  for (const r of tidy) {
    const key = [r.time ?? '', r.role.toLowerCase(), (r.name ?? '').toLowerCase(), r.note ?? ''].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out.map((r, i) => ({ ...r, position: i }))
}

// The first NAMED row in a role. This is how a job's single "photographer" — the
// Jobs filter, the search, the order's photographer column — is read off the
// sheet, so nothing that asked for one photographer had to change.
export function firstWithRole(crew = [], role) {
  return (crew || []).find((r) => same(r?.role, role) && clean(r?.name)) ?? null
}
export const crewNameFor = (crew, role) => firstWithRole(crew, role)?.name ?? ''

// Every named person on a sheet, once each.
export function crewNames(crew = []) {
  return [...new Set((crew || []).map((r) => clean(r?.name)).filter(Boolean))]
}

// The earliest call — what a calendar chip has room for: "when do I have to be
// there".
export function earliestCrewCall(crew = []) {
  const times = normalizeCrew(crew)
    .map((r) => r.time)
    .filter(Boolean)
  return times.length ? times[0] : null
}

// One row as a person reads it: "08:00 Photographer · Marcus Reed".
export function crewLine(r) {
  const who = [clean(r?.role), clean(r?.name)].filter(Boolean).join(' · ')
  return [r?.time, who].filter(Boolean).join(' ')
}

// The whole sheet on one line, for a tooltip — "08:00 Photographer (Marcus
// Reed) · 10:00 Model". The rows are joined with a middle dot, so a row names
// its person in brackets rather than with a second dot.
export function crewSummary(crew = []) {
  return normalizeCrew(crew)
    .map((r) => [r.time, r.name ? `${r.role} (${r.name})` : r.role].filter(Boolean).join(' '))
    .join(' · ')
}

// A wrap before the first call is a typo, not a shoot. Reported, never clamped —
// clamping would invent an hour nobody typed.
export function wrapBeforeFirstCrewCall(crew = [], wrapTime = null) {
  const first = earliestCrewCall(crew)
  const wrap = toHHMM(wrapTime)
  if (!first || !isValidTime(wrap)) return false
  return wrap < first
}

// What a row still needs before it can be saved, in the crew's words — or null.
// A row with nothing in it is fine: it is dropped.
export function crewRowProblem(r = {}) {
  const hasAny = clean(r.role) || clean(r.name) || clean(r.time) || clean(r.note)
  if (!hasAny) return null
  if (!clean(r.role)) return 'Pick a role for this row — or remove it.'
  if (clean(r.time) && !isValidTime(toHHMM(r.time))) return 'The time should read as HH:MM.'
  return null
}

// The roles a picker offers: the studio's own list, then every role a sheet
// already uses — a role typed once keeps being offered.
export function crewRoles(bookings = []) {
  const seen = new Set(CALL_ROLES.map((r) => r.toLowerCase()))
  const extra = []
  for (const b of bookings || [])
    for (const r of b?.crew || []) {
      const role = clean(r?.role)
      if (role && !seen.has(role.toLowerCase())) {
        seen.add(role.toLowerCase())
        extra.push(role)
      }
    }
  return [...CALL_ROLES, ...extra.sort((a, b) => a.localeCompare(b))]
}

// The two legacy lists → one sheet. The SAME rule migration 20260930120000
// applies to the database, written once in JS so the demo seed and prod can't
// describe different shapes: the photographer and the model are rows; every role
// of every call is a row, and a call joins the first row of its role that has no
// time yet ("08:00 Photographer" meets the photographer it was always about);
// an identical row is not added twice.
export function crewFromLegacy({ calls = [], photographer = '', model = '' } = {}) {
  const rows = []
  if (clean(photographer)) rows.push({ role: 'Photographer', name: clean(photographer), time: null, note: null })
  if (clean(model)) rows.push({ role: 'Model', name: clean(model), time: null, note: null })
  const ordered = [...(calls || [])].sort((a, b) => {
    const [x, y] = [toHHMM(a?.time), toHHMM(b?.time)]
    return x === y ? (a?.position ?? 0) - (b?.position ?? 0) : x < y ? -1 : 1
  })
  for (const c of ordered) {
    const time = toHHMM(c?.time) || null
    const note = clean(c?.note) || null
    for (const raw of c?.roles || []) {
      const role = clean(raw)
      if (!role) continue
      const target = rows.find((x) => same(x.role, role) && !x.time)
      if (target) {
        target.time = time
        target.note = target.note ?? note
        target.role = role
      } else if (!rows.some((x) => same(x.role, role) && x.time === time && !x.name && (x.note ?? '') === (note ?? ''))) {
        rows.push({ role, name: null, time, note })
      }
    }
  }
  return normalizeCrew(rows)
}
