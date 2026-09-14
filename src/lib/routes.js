// The address bar says which screen you are on.
//
// This app has no router and does not need one: `activeView` in the store is
// the source of truth and stays that way. What was missing is that the URL
// never changed, so a screen could not be linked to, a reload always landed on
// whatever localStorage remembered, and the browser's back arrow only walked
// the drill-in trail rather than the screens themselves.
//
// One definition of the mapping, PURE so plain Node can assert it.

// The path segment is USER-FACING TEXT, so it follows the label rather than the
// identifier: the store's view id is `orders` and the screen is called Jobs.
// Same split this codebase already settled for the `orders` TABLE, which also
// means Job — renaming the identifier would rewrite stored `viewState` keys for
// no visible gain.
export const VIEW_PATHS = {
  calendar: 'calendar',
  orders: 'jobs',
  inventory: 'inventory',
  people: 'people',
}

export const DEFAULT_VIEW = 'calendar'

// Trailing slash, leading slash, always. Vite's base is '/' on Vercel and
// '/kitbay/' in dev, and the two must not produce '//jobs' or 'jobs'.
export function normalizeBase(base) {
  const raw = String(base == null || base === '' ? '/' : base)
  const lead = raw.startsWith('/') ? raw : '/' + raw
  return lead.endsWith('/') ? lead : lead + '/'
}

// `import.meta.env` does not exist under plain Node, which is where the
// assertions run — hence the optional chain and the fallback.
export const BASE_PATH = normalizeBase(import.meta.env?.BASE_URL || '/')

// view -> the pathname to put in the address bar.
export function pathForView(view, base = BASE_PATH) {
  const seg = VIEW_PATHS[view] || VIEW_PATHS[DEFAULT_VIEW]
  return normalizeBase(base) + seg
}

// pathname -> view id, or NULL when it names no screen.
//
// Null is not an error and must not be treated as one: the caller keeps showing
// the view it already had and rewrites the address to match. A typo, an old
// link or a path from a future version therefore lands on a real screen instead
// of an error page — this app has no 404 of its own.
export function viewForPath(pathname, base = BASE_PATH) {
  const b = normalizeBase(base)
  const p = String(pathname || '')
  if (!p.startsWith(b)) return null
  const seg = p.slice(b.length).split('/').filter(Boolean)[0]
  if (!seg) return null
  const want = seg.toLowerCase()
  const hit = Object.keys(VIEW_PATHS).find((view) => VIEW_PATHS[view] === want)
  return hit || null
}

// The view a load should open on, given the address and what was remembered.
// An explicit link BEATS the stored screen — that is the whole point of one.
export function viewFromLocation(pathname, remembered) {
  return viewForPath(pathname) || remembered || DEFAULT_VIEW
}
