// How many shoots a place can take on one day, and the refusal when a job would
// go over. Pure — no store, no React — so plain Node can check the rule
// (`npm run test:lib`); the store re-exports all three, so every caller that
// imported them from there still does.
//
// Moved out of store.js when LOCATION stopped counting: a rule with an exception
// is exactly the kind that needs an assertion, and the store can't be loaded
// without a browser.
import { coversDay, firstFullDay, setSpanDays } from './setDays.js'
import { studioLabel, LOCATION_STUDIO } from '../data/studios.js'
import { formatDate } from './clock.js'

// A studio room runs at most this many shoots a day (the studio's own rule —
// "five sets a day"; epic #5 terminology).
export const MAX_SETS_PER_DAY = 5

// The cap exists because a ROOM holds five sets a day. Location is not a room:
// every location shoot is its own venue (Pier 59, a client's office), so six on
// one day is six different places, not an overbooked studio. Settled with the
// studio.
export const hasDailyCap = (studioId) => !!studioId && studioId !== LOCATION_STUDIO

// How many shoots a studio already holds on ONE day. A set can span days now,
// so this asks whether its window covers the day, not whether it starts on it.
// Archived shoots don't count — they left the calendar, and counting them
// quietly shrank the studio's capacity.
export function setsUsedOn(bookings, studioId, iso, excludeSetId = null) {
  return (bookings ?? []).filter(
    (b) =>
      b.studioId === studioId &&
      b.status === 'active' &&
      !b.archivedAt &&
      b.id !== excludeSetId &&
      coversDay(b.date, b.endDate, iso),
  ).length
}

// Capacity is per studio per DAY, so a multi-day job has to clear every day it
// covers. Returns a sentence naming WHICH day is full — without that the crew
// has to guess which end of the range to move — or null when the range fits.
//
// `excludeSetId` is the shoot being edited: it must not count against itself, or
// stretching a job by one day would report the studio as full of itself.
export function capacityError(bookings, { studioId, from, to, excludeSetId = null }) {
  if (!from || !hasDailyCap(studioId)) return null
  const countOn = (iso) => setsUsedOn(bookings, studioId, iso, excludeSetId)
  const full = firstFullDay(from, to, countOn, MAX_SETS_PER_DAY)
  if (!full) return null
  const span = setSpanDays(from, to)
  const n = countOn(full)
  return `${studioLabel(studioId)} already has ${n} shoot${n === 1 ? '' : 's'} on ${formatDate(full)} (max ${MAX_SETS_PER_DAY}). Pick another studio${
    span > 1 ? ', or shorten the range' : ' or another date'
  }.`
}
