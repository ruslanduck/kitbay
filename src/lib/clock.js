// How TIME reads in this app — the one place that knows.
//
// The studio works on the American 12-hour clock: "5PM", not "17:00" (asked
// for in so many words). Storage does NOT change: a call time stays "HH:MM",
// 24-hour — it is what a Postgres `time` holds, and it sorts as plain text,
// which is what puts a call sheet in the order of the day. Only what a person
// READS goes through here, and what they TYPE is read back by
// `parseTimeInput` (lib/callTimes), which understands both clocks.
//
// PURE — no React, no store, no date library — so `npm run test:lib` can
// assert it under plain Node, and the PDF builders can print with it.
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

// A MOMENT — when something happened: "01 Oct 2026, 2:32PM". One fixed English
// format, the same on screen and on paper (the packing list prints it). NOT the
// browser's locale: `toLocaleString()` put 24-hour times and seconds on a
// machine set to Russian and a different shape again on an American one, so
// one card could show the same kind of stamp two ways.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function whenLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const time = formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time}`
}
