// The studio's five rooms, plus "L" — LOCATION: a shoot somewhere else (Pier 59
// / Studio 101, a client's office). Settled with the studio; for a long time
// this file called L "a large studio", which it never was. L keeps its one-letter
// id — it is the calendar's row key and every stored job carries it — and the
// ADDRESS of a location shoot lives on the job, in `orders.location`.
export const STUDIOS = ['1', '2', '3', '4', '5', 'L']

export const LOCATION_STUDIO = 'L'

export function studioLabel(id) {
  return id === LOCATION_STUDIO ? 'Location' : `Studio ${id}`
}

// Where a job happens, in words: "Studio 3", or "Location · Pier 59 / Studio 101"
// for a job booked on L that carries an address. One definition for the job
// card, the peek card and both PDFs. An address never rides on a studio shoot,
// even if one is still sitting in the data.
export function placeLabel(studioId, location) {
  if (!studioId) return null
  const place = studioId === LOCATION_STUDIO ? String(location ?? '').trim() : ''
  return place ? `${studioLabel(studioId)} · ${place}` : studioLabel(studioId)
}

// Stable per-studio colors — used to color-code chips in the month view.
export const STUDIO_COLORS = {
  1: '#3b82f6', // blue
  2: '#ec4899', // pink
  3: '#10b981', // emerald
  4: '#f59e0b', // amber
  5: '#8b5cf6', // violet
  L: '#06b6d4', // cyan
}

export function studioColor(id) {
  return STUDIO_COLORS[id] ?? '#64748b'
}
