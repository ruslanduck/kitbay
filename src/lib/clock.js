// How TIME and DATES read in this app — the one place that knows.
//
// The studio works the American way: the 12-hour clock ("5PM", not "17:00") and
// month-first dates ("Oct 1, 2026", not "01 Oct 2026" or "2026-10-01"), both
// asked for in so many words. Storage does NOT change: a call time stays "HH:MM",
// 24-hour, and a day stays ISO "YYYY-MM-DD" — they are what Postgres `time` and
// `date` hold, and they sort as plain text, which is what puts a call sheet in
// the order of the day and a list of jobs in date order. Only what a person
// READS goes through here; what they TYPE is read back by `parseTimeInput`
// (lib/callTimes) and `parseDateInput` below.
//
// PURE — no React, no store, no date library — so `npm run test:lib` can assert
// it under plain Node, and the PDF builders can print with it.
import { isValidTime, toHHMM } from './callTimes.js'

const pad = (n) => String(n).padStart(2, '0')

// "17:00" → "5PM" · "17:30" → "5:30PM" · "00:00" → "12AM" · "12:00" → "12PM".
// On the hour the minutes are left off, the way the studio writes it.
// Anything that isn't a time comes back as it was ('' for nothing), so a
// half-typed value is never dressed up as one.
export function formatTime(t) {
  if (t == null || t === '') return ''
  const hhmm = toHHMM(String(t))
  if (!isValidTime(hhmm)) return String(t)
  const [h, m] = hhmm.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return m === 0 ? `${h12}${period}` : `${h12}:${pad(m)}${period}`
}

// A picker's hour row: "17" → "5PM".
export const hourLabel = (hh) => formatTime(`${pad(Number(hh))}:00`)

// The one list of month names — the span labels and the month picker read it
// too, where four copies used to live.
export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS = MONTH_ABBR
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const realDay = (y, m, d) =>
  Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d) &&
  y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m)

// The parts of a day. A stored DAY ("2026-10-01") is read LITERALLY: through
// `new Date()` it would be UTC midnight, which in New York is the evening of
// Sep 30 — the date a person reads would slip by one. A full timestamp (or a
// Date) is a moment, and is read in local time.
function dayParts(v) {
  if (v == null || v === '') return null
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() }
  }
  const s = String(v)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    return realDay(y, m, d) ? { y, m, d } : null
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(s)) return null
  const t = new Date(s)
  return Number.isNaN(t.getTime()) ? null : { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }
}

// A calendar DATE, month first: "Oct 1, 2026". Anything that isn't a date comes
// back as it was ('' for nothing).
export function formatDate(v) {
  const p = dayParts(v)
  if (!p) return v == null ? '' : String(v)
  return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`
}

// A span of days with its year said once: "Sep 30, 2026" · "Sep 28 – 30, 2026"
// · "Sep 28 – Oct 4, 2026" · "Dec 30, 2026 – Jan 2, 2027". The end may be missing
// or equal to the start (a one-day shoot).
export function formatDateRange(from, to) {
  const a = dayParts(from)
  if (!a) return formatDate(from)
  const b = dayParts(to)
  if (!b || (b.y === a.y && b.m === a.m && b.d === a.d)) return formatDate(from)
  if (a.y !== b.y) return `${formatDate(from)} – ${formatDate(to)}`
  if (a.m === b.m) return `${MONTHS[a.m - 1]} ${a.d} – ${b.d}, ${a.y}`
  return `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}, ${a.y}`
}

// A MOMENT — when something happened: "Oct 1, 2026, 2:32PM". One fixed English
// format, the same on screen and on paper (the packing list prints it). NOT the
// browser's locale: `toLocaleString()` put 24-hour times and seconds on a
// machine set to Russian and a different shape again on an American one, so
// one card could show the same kind of stamp two ways.
export function whenLabel(iso) {
  if (!iso) return ''
  // A bare DAY is a date, not a moment (the local seed stamps carry no time):
  // through the Date parser it would gain a time nobody recorded — midnight
  // UTC, which in New York is the evening BEFORE.
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return formatDate(iso)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const time = formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
  return `${formatDate(d)}, ${time}`
}

// What a person TYPES into a date field, read the American way — month first:
//   "9/30/2026" · "09/30/2026" · "9/30/26" · "9-30-2026" · "9.30.2026"
//   "Sep 30, 2026" · "September 30 2026" · "30 Sep 2026"
// and the stored ISO itself ("2026-09-30"), for whoever pastes one. A two-digit
// year is this century. Returns '' for anything that is not a real day — a
// February 30th, a 13th month, a day with no year — so the caller can leave what
// was typed alone rather than overwrite it with a guess.
export function parseDateInput(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  const done = (y, m, d) => (realDay(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : '')
  const year = (s) => (s.length === 2 ? 2000 + Number(s) : s.length === 4 ? Number(s) : NaN)

  let g = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (g) return done(Number(g[1]), Number(g[2]), Number(g[3]))
  g = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text)
  if (g) return done(year(g[3]), Number(g[1]), Number(g[2]))

  // A month by name, in either order around the day: "Sep 30 2026", "30 Sep 2026".
  const words = text.toLowerCase().replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length !== 3) return ''
  const at = words.findIndex((w) => /^[a-z]+$/.test(w))
  if (at < 0) return ''
  const name = words[at]
  const month = name.length >= 3 ? MONTHS_LONG.findIndex((n) => n.toLowerCase().startsWith(name)) : -1
  if (month < 0) return ''
  const [day, yr] = words.filter((_, i) => i !== at)
  if (!/^\d{1,2}$/.test(day) || !/^(\d{2}|\d{4})$/.test(yr)) return ''
  return done(year(yr), month + 1, Number(day))
}
