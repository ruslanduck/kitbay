// Order search (epic #5, 5.7).
//
// Pure functions — no React — so the matching rules can be tested directly and
// the Orders view stays a thin shell over them.
import { OTHER, choiceOf } from './otherChoice.js'
import { formatDateRange } from './clock.js'
//
// The point of this search is fast access to job history: the crew knows one
// thing (a PO from accounting, a job name, roughly when it shot, or who shot it)
// and needs the order. So:
//   • the text box takes SEVERAL terms and requires all of them, each matching any
//     field — "nike 4490" finds the Nike job on PO-4490 without a field picker;
//   • dates are matched by OVERLAP against the order's working window, not by
//     string prefix, so "everything shooting that week" is a real question;
//   • orders sharing a PO are counted, because one job's PO covers every order
//     raised against it and that grouping IS the job history.


export const SORTS = {
  newest: { label: 'Newest first' },
  oldest: { label: 'Oldest first' },
  job: { label: 'Shoot name (A–Z)' },
}

// Everything a free-text term may match.
//
// Studio is deliberately NOT in here. It used to be, as its label, and it made
// short numeric terms useless: "studio 2" matched almost every order, because the
// term "2" is a substring of every 2026 date. Studio is an exact-match dropdown
// instead — a filter, not a search term.
function haystack(order) {
  return [
    order.poNumber,
    order.jobName,
    order.setTitle,
    // The hand-typed set designation ("OMSet1") — searchable on its own, which is
    // the point of pulling it out of the job name.
    order.setLabel,
    // Every assignee, not just the first: "jonas" finds the jobs Jonas is on.
    // (A job saved before roles existed holds plain names.)
    ...(order.assignees ?? []).map((a) => (typeof a === 'string' ? a : a?.name)),
    // Brand and shoot type are BOTH dropdowns AND free text: "nike editorial"
    // should answer without picking two fields first. Unlike the studio (which
    // was pulled OUT of the haystack because a bare "2" matched every 2026
    // date), these are words, so they can't swamp a numeric search.
    order.brand,
    order.jobType,
    // A location shoot's address — "pier 59" should find the job.
    order.location,
    order.number,
    order.startsOn,
    order.endsOn,
    // As the card prints it — "sep 28" finds the job the way the list reads.
    order.startsOn ? formatDateRange(order.startsOn, order.endsOn) : null,
    order.companyName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

// A period whose end is BEFORE its start. No job can match it, so the filter
// has to say so — two bare date boxes gave no clue which was which, and a
// backwards range just emptied the list in silence.
export function rangeIsBackwards(from, to) {
  return !!(isDay(from) && isDay(to) && from > to)
}

// A real ISO day. The date fields hand on what they could NOT read as typed (so
// the field can say so), and a bound like "13/45/2026" compared as text sorts
// before every 2026 date — it emptied the list. Such a bound is not a bound.
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''))

// Does [aFrom, aTo] overlap [bFrom, bTo]? Open ends mean "unbounded".
function windowsOverlap(aFrom, aTo, bFrom, bTo) {
  const start = aFrom || aTo || null
  const end = aTo || aFrom || null
  if (bFrom && end && end < bFrom) return false
  if (bTo && start && start > bTo) return false
  // An order with no dates at all can't satisfy a date filter.
  if (!start && !end && (bFrom || bTo)) return false
  return true
}

export function matchesOrder(
  order,
  {
    text = '',
    status = 'All',
    studio = 'All',
    brand = 'All',
    jobType = 'All',
    from = '',
    to = '',
  } = {},
) {
  if (status !== 'All' && order.status !== status) return false
  if (studio !== 'All' && (order.studioId ?? '') !== studio) return false
  if (brand !== 'All' && (order.brand ?? '') !== brand) return false
  // "Other" is every type outside the fixed list — what was typed beside it is
  // the job's own detail, findable in the text box, never a filter option.
  if (jobType !== 'All' && choiceOf(order.jobType, JOB_TYPES) !== jobType) return false
  // A period that ends before it starts contains no days, so nothing can be in
  // it. Without this a job SPANNING both dates slipped through, because the two
  // one-sided tests below are each satisfied independently — measured: the
  // backwards range 09-11 → 09-10 still returned the job running 09-10 → 09-11,
  // which made the warning beside those fields untrue.
  if (!isDay(from)) from = ''
  if (!isDay(to)) to = ''
  if (rangeIsBackwards(from, to)) return false
  if ((from || to) && !windowsOverlap(order.startsOn, order.endsOn, from, to)) return false

  const terms = String(text).toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const hay = haystack(order)
  return terms.every((t) => hay.includes(t))
}

function compare(sort) {
  if (sort === 'oldest') return (a, b) => String(a.startsOn ?? '').localeCompare(String(b.startsOn ?? ''))
  if (sort === 'job')
    return (a, b) => String(a.jobName ?? a.setTitle ?? '').localeCompare(String(b.jobName ?? b.setTitle ?? ''))
  // newest: undated orders sink to the bottom rather than floating to the top.
  return (a, b) => String(b.startsOn ?? '').localeCompare(String(a.startsOn ?? ''))
}

// How many orders share each PO — the job-history count shown on a row.
export function poCounts(orders) {
  const counts = {}
  for (const o of orders) {
    if (!o.poNumber) continue
    counts[o.poNumber] = (counts[o.poNumber] ?? 0) + 1
  }
  return counts
}

export function searchOrders(orders, criteria = {}) {
  const { sort = 'newest' } = criteria
  return (orders ?? []).filter((o) => matchesOrder(o, criteria)).sort(compare(sort))
}

// Distinct studios present, for the filter dropdown.
export function studiosIn(orders) {
  return [...new Set((orders ?? []).map((o) => o.studioId).filter(Boolean))].sort()
}

// The brands the studio shoots for. FREE TEXT still — `brandsIn` merges these
// with every brand the register already carries, so another label needs no code
// and a job that says something else keeps saying it.
export const BRANDS = ['Ann Taylor', 'Loft']

// Brands, offered before a job uses one. Built from the data ALONE the list was
// empty on a register where nobody had typed a brand yet — reported as exactly
// that — which reads as a broken dropdown rather than as an empty column.
// (Consequence, deliberate: the FILTER can offer a brand that currently matches
// nothing.)
export function brandsIn(orders) {
  const used = (orders ?? []).map((o) => o.brand).filter(Boolean)
  return [...new Set([...BRANDS, ...used.sort((a, b) => a.localeCompare(b))])]
}

// The two shoot types the studio runs. A FIXED list now, plus Other with what
// it is typed beside it (lib/otherChoice): the list used to merge in every type
// a job carried, so one "Test" became an option for everybody, for good.
export const JOB_TYPES = ['Editorial', 'PDP']
// The filter offers the same choices — "Other" catches every typed type.
export const JOB_TYPE_FILTERS = [...JOB_TYPES, OTHER]

// The CALENDAR's filter: every job, one of the two types the studio works in,
// or Other — every type typed beside Other ("Lookbook", "test"…), all of them at
// once. Asked for as "все джобы, только PDP или только Editorial", then "и Other
// все варианты". A job with no type at all is not Other: it shows under All only.
export const CALENDAR_TYPE_FILTERS = ['all', 'PDP', 'Editorial', OTHER]
export function matchesTypeFilter(jobType, filter) {
  if (!filter || filter === 'all') return true
  return choiceOf(jobType, JOB_TYPES) === filter
}


// A SET name is how a PDP day tells its sets apart ("OMSet1", "OMSet2"); an
// editorial shoot has none. So the field belongs to PDP — and to a job with no
// type yet, which is where every job predating shoot types sits: 13 of the 20
// on prod carry a set name and no type, and hiding theirs would erase it on the
// next save.
export function setNameApplies(jobType) {
  const t = String(jobType ?? '').trim().toLowerCase()
  return t === '' || t === 'pdp'
}

// Where a job is SHOWN — card, peek, both PDFs — a stored set name is always
// shown (it is data, and the next save of a non-PDP job clears it); an empty row
// only where a set name belongs.
export const showsSetName = (order) => !!order?.setLabel || setNameApplies(order?.jobType)

