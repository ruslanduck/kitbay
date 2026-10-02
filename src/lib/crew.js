// The call sheet, the way the studio asked for it: every row is a TIME · ROLE ·
// PERSON — "10AM · Producer · Clay Rodriguez". One role and one person per row,
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
import { formatTime } from './clock.js'

const clean = (s) => String(s ?? '').trim()
const same = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase()

// A role the studio's list has, in the list's own spelling ("photographer" is
// Photographer); anything else is an Other's detail and is kept as typed.
export const canonicalRole = (role) => CALL_ROLES.find((r) => same(r, role)) ?? clean(role)

// A row as the app holds it. `contactId` is the person in People when the row
// was read from the database; a changed name drops it (the form does that), so
// the write resolves the name again.
export function crewRow(r = {}, i = 0) {
  const time = toHHMM(r?.time)
  return {
    id: r?.id ?? null,
    role: canonicalRole(r?.role),
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

// The earliest call: "when does anybody have to be there". The shoot's GENERAL
// call (everyone, no role) is a call too.
export function earliestCrewCall(crew = [], generalCall = null) {
  const general = toHHMM(generalCall)
  const times = [
    ...(isValidTime(general) ? [general] : []),
    ...normalizeCrew(crew)
      .map((r) => r.time)
      .filter(Boolean),
  ].sort()
  return times.length ? times[0] : null
}

// One row as a person reads it: "08:00 Photographer · Marcus Reed".
export function crewLine(r) {
  const who = [clean(r?.role), clean(r?.name)].filter(Boolean).join(' · ')
  return [r?.time, who].filter(Boolean).join(' ')
}

// The sheet as it is READ and edited: a call is one LINE — a time, a role and
// everyone called for it ("10:00 · Model · Hailey Halter, Valery Kaufman").
// Asked for: "всю команду можно выбирать — несколько людей". The database keeps
// one row per person, because that row is what puts a person on a shoot and
// builds their work history; these two turn one shape into the other. Rows
// share a line when time, role and note all match — the note is what tells two
// calls of one role apart ("freight door" vs "park on 9th").
export function groupCrew(rows = []) {
  const out = []
  const at = new Map()
  for (const r of normalizeCrew(rows)) {
    const key = [r.time ?? '', r.role.toLowerCase(), r.note ?? ''].join('|')
    let line = at.get(key)
    if (!line) {
      line = { id: r.id, time: r.time, role: r.role, note: r.note, people: [] }
      at.set(key, line)
      out.push(line)
    }
    if (r.name && !line.people.some((p) => same(p.name, r.name)))
      line.people.push({ name: r.name, contactId: r.contactId ?? null })
  }
  return out
}

// A line back to rows: one per person, or one with nobody booked yet.
export function expandCrew(lines = []) {
  const rows = []
  for (const l of lines || []) {
    const people = (l?.people || []).filter((p) => clean(p?.name))
    const base = { role: l?.role, time: l?.time, note: l?.note }
    if (!people.length) rows.push({ ...base, name: null, contactId: null })
    else for (const p of people) rows.push({ ...base, name: clean(p.name), contactId: p.contactId ?? null })
  }
  return normalizeCrew(rows)
}

// The whole sheet on one line, for a tooltip — "08:00 Photographer (Marcus
// Reed) · 10:00 Model (Hailey Halter, Valery Kaufman)". The lines are joined
// with a middle dot, so a line names its people in brackets.
export function crewSummary(crew = [], generalCall = null) {
  return scheduleLines(crew, generalCall)
    .map((l) =>
      l.general
        ? `${formatTime(l.time)} General call`
        : [
            // A row called with everyone follows the general call; repeating
            // its time on every one of them would only be noise.
            l.atGeneral ? null : formatTime(l.time),
            l.people.length ? `${l.role} (${l.people.map((p) => p.name).join(', ')})` : l.role,
          ]
            .filter(Boolean)
            .join(' '),
    )
    .join(' · ')
}

// The call sheet as it is READ: its lines in the order of the day, with the
// shoot's GENERAL call (everyone, no role, no person) taking its place among
// them by time. A sheet is read as a schedule, so a producer called before
// everyone else stays above the general call; at the same hour the general call
// comes first — it is the default, a row is the exception.
// A row with no time of its own is called WITH everyone, so it reads at the
// general call and is listed right under it — not at the end of the day with a
// blank where its time should be. It is marked `atGeneral` so a surface can tell
// it from a time somebody typed, and nothing is stored: change the general call
// and those rows follow. The general line itself is `{ general: true, time }`;
// a half-typed general call adds nothing.
export function scheduleLines(crew = [], generalCall = null) {
  const lines = groupCrew(crew)
  const time = toHHMM(generalCall)
  if (!isValidTime(time)) return lines
  const general = { id: 'general-call', general: true, time, role: '', note: null, people: [] }
  const covered = lines.filter((l) => !l.time).map((l) => ({ ...l, time, atGeneral: true }))
  const timed = lines.filter((l) => l.time)
  const at = timed.findIndex((l) => l.time >= time)
  const before = at === -1 ? timed : timed.slice(0, at)
  const after = at === -1 ? [] : timed.slice(at)
  return [...before, general, ...covered, ...after]
}

// A wrap before the first call is a typo, not a shoot. Reported, never clamped —
// clamping would invent an hour nobody typed.
// What a calendar chip says about call times. A bare "6AM" read as nothing in
// particular — it was somebody's early call while the shoot had a general call
// of 8AM — so every time on the chip is NAMED: the general call first (it is
// when everyone comes), then the earliest individual call when it is earlier
// than that ("General 8AM · First 6AM"). With no general call, the earliest call
// is the one there is ("First call 6AM"); with neither, nothing.
export function chipCallLabel(crew = [], generalCall = null) {
  const g = toHHMM(generalCall)
  const general = isValidTime(g) ? g : null
  const first = normalizeCrew(crew)
    .map((r) => r.time)
    .filter(Boolean)
    .sort()[0] ?? null
  if (general)
    return first && first < general
      ? `General ${formatTime(general)} · First ${formatTime(first)}`
      : `General ${formatTime(general)}`
  return first ? `First call ${formatTime(first)}` : ''
}

export function wrapBeforeFirstCrewCall(crew = [], wrapTime = null, generalCall = null) {
  const first = earliestCrewCall(crew, generalCall)
  const wrap = toHHMM(wrapTime)
  if (!first || !isValidTime(wrap)) return false
  return wrap < first
}

// What a row still needs before it can be saved, in the crew's words — or null.
// A row with nothing in it is fine: it is dropped.
export function crewRowProblem(r = {}) {
  // A form line carries `people`; a stored row carries one `name`.
  const named = clean(r.name) || (r.people || []).some((p) => clean(p?.name))
  const hasAny = clean(r.role) || named || clean(r.time) || clean(r.note)
  if (!hasAny) return null
  if (!clean(r.role)) return 'Pick a role for this row — or remove it.'
  if (clean(r.time) && !isValidTime(toHHMM(r.time))) return 'Use a time like 9AM or 5:30PM.'
  return null
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
