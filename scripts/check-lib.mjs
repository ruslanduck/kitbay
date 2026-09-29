// Assertions over the PURE modules in src/lib, run by plain Node.
//
// Why this file exists: the app's logic deliberately lives in side-effect-free
// modules so it can be checked without a browser — but until now those checks
// lived in a scratchpad and vanished with the session, so they protected the
// change that prompted them and nothing after it. A rename that rewrote 69
// user-facing strings across 16 files is exactly the kind of edit that needs a
// net underneath it, so the net is committed now and runs in CI.
//
// Deliberately NOT a test framework: no dependency, no watch mode, no mocks.
// `npm run test:lib` either prints a count or fails loudly with the assertion
// that broke.
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const load = (p) => import(pathToFileURL(resolve(p)).href)
const [activity, barcode, orderSearch, estimate, estimatePdf, packingPdf, packing, itemAvail, years, orderStatus, setDays, callTimes, taxonomy, inventoryData, unitRows, theme, ordering, patch, peopleOptions, routes, nav, studios, capacity, crew] =
  await Promise.all([
    load('src/lib/activity.js'),
    load('src/lib/barcode.js'),
    load('src/lib/orderSearch.js'),
    load('src/lib/estimate.js'),
    load('src/lib/estimatePdf.js'),
    load('src/lib/packingListPdf.js'),
    load('src/lib/packing.js'),
    load('src/lib/itemAvailability.js'),
    load('src/lib/years.js'),
    load('src/data/orderStatus.js'),
    load('src/lib/setDays.js'),
    load('src/lib/callTimes.js'),
    load('src/lib/taxonomy.js'),
    load('src/data/inventory.js'),
    load('src/lib/unitRows.js'),
    load('src/lib/theme.js'),
    load('src/lib/ordering.js'),
    load('src/lib/patch.js'),
    load('src/lib/peopleOptions.js'),
    load('src/lib/routes.js'),
    load('src/data/nav.js'),
    load('src/data/studios.js'),
    load('src/lib/capacity.js'),
    load('src/lib/crew.js'),
  ])

let n = 0
const ok = (c, label) => {
  n++
  assert.ok(c, label)
}
const eq = (a, b, label) => {
  n++
  assert.deepStrictEqual(a, b, `${label}\n  got:      ${JSON.stringify(a)}\n  expected: ${JSON.stringify(b)}`)
}

// ─────────────────────────────────────────────── the record is called a JOB
// The word the studio uses. The DB table, the event types and the state keys
// still say `order` on purpose — renaming those would break stored data — so
// these assertions pin the LABELS without touching the identifiers.
for (const [type, expected] of [
  [activity.EVENT.ORDER_CREATED, 'Created the job'],
  [activity.EVENT.ORDER_UPDATED, 'Edited the job'],
  [activity.EVENT.ORDER_CONFIRMED, 'Confirmed the job'],
  [activity.EVENT.ORDER_CLOSED, 'Closed the job'],
  [activity.EVENT.ORDER_REOPENED, 'Re-opened the job'],
  [activity.EVENT.ORDER_DELETED, 'Scrapped the job'],
]) {
  eq(activity.describeEvent({ type, data: {} }).title, expected, `${type} reads as a job`)
}
eq(activity.archiveKindLabel('order'), 'job', 'an archived job reads as a job')
ok(
  activity.describeEvent({ type: activity.EVENT.ARCHIVED, data: { what: 'order' } }).title.includes('job'),
  'and so does the archive event — the stored key stays "order" for old rows',
)
eq(activity.archiveKindLabel('booking'), 'shoot', 'a shoot is still a shoot')
for (const t of Object.values(activity.EVENT)) {
  const r = activity.describeEvent({ type: t, data: {} })
  ok(r?.title, `every event type still renders a title: ${t}`)
  ok(!/\border\b/i.test(r.title), `and none of them says "order": ${t}`)
}

// lib/barcode — the one rule every barcode field shares. The reported case was
// a code COPIED off the screen, which brings the decorative `#` with it and was
// refused as "not in the register".
eq(barcode.normalizeBarcode('#0806'), '0806', 'a copied code loses its decorative hash')
eq(barcode.normalizeBarcode('  0806' + String.fromCharCode(13, 10)), '0806', "and a reader's trailing return is trimmed")
eq(barcode.normalizeBarcode('##0806'), '0806', 'however many hashes it arrives with')
eq(barcode.normalizeBarcode('# 0806 '), '0806', 'with space between the hash and the digits')
eq(barcode.normalizeBarcode('0806'), '0806', 'a bare code is left exactly as it is')
eq(barcode.normalizeBarcode(''), '', 'empty stays empty')
eq(barcode.normalizeBarcode(null), '', 'and nothing at all is not the string "null"')
eq(barcode.normalizeBarcode('SF0T9197'), 'SF0T9197', 'a serial is not mangled either')

// ─────────────────────────────────────────────── brand + shoot type
const jobs = [
  { id: 'j1', jobName: 'Nike SS26', brand: 'Nike', jobType: 'Editorial', status: 'confirmed', studioId: '2', startsOn: '2026-09-10', endsOn: '2026-09-10' },
  { id: 'j2', jobName: 'H&M Basics', brand: 'H&M', jobType: 'PDP', status: 'hold', studioId: '1', startsOn: '2026-09-11', endsOn: '2026-09-11' },
  { id: 'j3', jobName: 'Zara drop', brand: 'Nike', jobType: 'PDP', status: 'confirmed', studioId: '2', startsOn: '2026-09-12', endsOn: '2026-09-12' },
  { id: 'j4', jobName: 'legacy', brand: null, jobType: null, status: 'confirmed', studioId: '3', startsOn: '2026-09-13', endsOn: '2026-09-13' },
]
const ids = (c) => orderSearch.searchOrders(jobs, c).map((o) => o.id).sort()
eq(ids({ brand: 'Nike' }), ['j1', 'j3'], 'brand filter')
eq(ids({ jobType: 'PDP' }), ['j2', 'j3'], 'shoot-type filter')
eq(ids({ brand: 'Nike', jobType: 'PDP' }), ['j3'], 'the two narrow together')
eq(ids({ brand: 'All', jobType: 'All' }), ['j1', 'j2', 'j3', 'j4'], '"All" filters nothing')
eq(ids({ text: 'nike editorial' }), ['j1'], 'free text spans brand and type — no field picker')
eq(ids({ brand: 'Nike', text: 'legacy' }), [], 'a job with no brand never matches a brand filter')
ok(orderSearch.searchOrders(jobs, { text: 'legacy' }).length === 1, 'but stays findable by name')
// The studio's own brands lead, then whatever the register carries — deduped
// and sorted. Built from the DATA alone the list was empty until someone typed
// a brand, which read as a broken dropdown.
eq(orderSearch.brandsIn(jobs), ['Ann Taylor', 'Loft', 'H&M', 'Nike'], 'brand options: offered + used')
eq(orderSearch.brandsIn([]), ['Ann Taylor', 'Loft'], 'no jobs still offers the studio brands')
// A style-out books a studio, has a call sheet and pulls gear like a shoot, so
// it is a TYPE rather than a second kind of record — that is what lets the day
// view list "all shoots + style-outs" without a parallel entity.
eq(
  orderSearch.jobTypesIn([]),
  ['Editorial', 'PDP'],
  'the types the studio names are offered from day one',
)
eq(
  orderSearch.jobTypesIn([{ jobType: 'Lookbook' }]),
  ['Editorial', 'PDP', 'Lookbook'],
  'a new type joins',
)
eq(
  orderSearch.jobTypesIn([{ jobType: 'PDP' }]),
  ['Editorial', 'PDP'],
  'and a used default is not duplicated',
)
// the studio stays OUT of free text: a bare "2" would match every 2026 date
eq(orderSearch.searchOrders(jobs, { text: 'studio' }).length, 0, 'studio is a dropdown, not a search term')

// ─────────────────────────────────────────────── the money and the documents
const inventory = [
  { id: 'i1', name: 'Profoto D2', kind: 'barcoded', dayRate: 90, units: [{ id: 'u1', barcode: '0801', serial: null }] },
  { id: 'i2', name: 'Gaffer tape', kind: 'non_barcoded', dayRate: null, quantity: 10 },
]
const job = {
  id: 'o1', number: 'CL-1', poNumber: 'PO-9', jobName: 'Nike SS26', setLabel: 'OMSet1',
  brand: 'Nike', jobType: 'Editorial', studioId: '2', status: 'confirmed',
  startsOn: '2026-09-10', endsOn: '2026-09-10', photographer: 'Ann Taylor',
  lines: [{ itemId: 'i1', quantity: 2 }, { itemId: 'i2', quantity: 3 }],
}
const booking = { id: 's1', unitIds: ['u1'], roster: [] }
const est = estimate.buildEstimate(job, { inventory })
eq(est.days, 1, 'a shoot is one day')
eq(est.total, 180, '2 x $90 x 1 day; the unrated line adds nothing')
eq(est.order.brand, 'Nike', 'the estimate carries the brand to both documents')
eq(est.order.jobType, 'Editorial', 'and the shoot type')
eq(estimate.billableDays('2026-09-10', '2026-09-12'), 3, 'a legacy span still bills inclusively')
eq(estimate.money(0), '$0.00', '$0 is a real price')

const bytes = (doc) => Buffer.from(doc.output('arraybuffer')).toString('latin1')
for (const [label, doc] of [
  ['estimate', estimatePdf.buildEstimatePdf(est, { booking })],
  ['packing list', packingPdf.buildPackingListPdf(est, { booking, inventory })],
]) {
  const t = bytes(doc)
  ok(t.includes('Kitbay'), `${label}: the letterhead is Kitbay`)
  ok(!t.includes('AnnTaylor'), `${label}: and not the old brand`)
  ok(t.includes('Job ref'), `${label}: the reference row says Job`)
  ok(!t.includes('Order ref'), `${label}: not Order`)
  ok(t.includes('Brand') && t.includes('Nike'), `${label}: prints the brand`)
  ok(t.includes('Shoot type') && t.includes('Editorial'), `${label}: prints the shoot type under its own name`)
  ok(t.includes('Set name') && t.includes('OMSet1'), `${label}: and the set name the crew reads`)
  // The renamed labels must not survive anywhere on the paper — a document
  // that says "Type" while the screen says "Shoot type" is two vocabularies.
  ok(!t.includes('Set date'), `${label}: no "Set date(s)" left`)
  ok(doc.getNumberOfPages() >= 1, `${label}: builds`)
}
ok(!bytes(packingPdf.buildPackingListPdf(est, { booking, inventory })).includes('$'), 'a packing list carries no money')
ok(estimatePdf.estimateFileName(est).endsWith('.pdf'), 'estimate filename')
ok(packingPdf.packingListFileName(est.order).endsWith('.pdf'), 'pull-sheet filename')
ok(!packingPdf.packingListFileName({}).includes('order'), 'and a nameless job does not fall back to "order"')

// ─────────────────────────────────────────────── the rules that hold stock
eq(packing.PACKING_SLOTS, [packing.PACKED_SLOT], 'one tick per row')
{
  // 2 copies asked for, 1 actually reserved: a row for the copy, a row for the
  // shortfall (it must SAY it has no unit, not vanish off the sheet) and one
  // counted row for the tape.
  const rows = packing.packingRows(est, { inventory, booking }).flatMap((g) => g.lines)
  eq(rows.length, 3, 'one row per barcoded copy, plus the shortfall, plus counted stock')
  eq(rows.filter((r) => r.barcode).map((r) => r.barcode), ['0801'], 'the reserved copy carries its barcode')
  eq(rows.find((r) => r.why === 'counted stock')?.quantity, 3, 'counted stock stays one row with its quantity')
  ok(
    rows.some((r) => /reserv/i.test(r.why || '')),
    'and the piece with no unit behind it says so rather than disappearing',
  )
  eq(packing.packingProgress(rows, {}), { total: 3, packed: 0 }, 'nothing packed yet')
}
eq(itemAvail.covers({ from: '2026-09-06', to: '2026-09-15' }, '2026-09-10'), true, 'a span covers a day inside it')
eq(itemAvail.covers({ from: '2026-09-06' }, '2026-09-07'), false, 'a missing end is exactly one day')
eq(itemAvail.nextIso('2026-12-31'), '2027-01-01', 'the ISO stepper crosses a year')
ok(orderStatus.isClosedStatus('fulfilled'), 'fulfilled is closed')
ok(!orderStatus.isClosedStatus('confirmed'), 'confirmed is not')

// ───────────────────────────────── the four statuses, and their four colours
// The calendar paints a chip by its job's status, so a status with no colour —
// or a colour that disagrees with its pill — is a chip that lies.
eq(
  orderStatus.ORDER_STATUS_CHOICES,
  ['hold', 'confirmed', 'fulfilled', 'canceled'],
  'the statuses a person can pick, in the order a job travels through them',
)
for (const v of orderStatus.ORDER_STATUS_CHOICES) {
  const meta = orderStatus.ORDER_STATUS[v]
  ok(meta, `${v} is in the vocabulary`)
  ok(/^#[0-9a-f]{6}$/i.test(meta.calendar), `${v} has a calendar colour: ${meta.calendar}`)
  eq(orderStatus.orderStatusColor(v), meta.calendar, `${v}: chip and pill read one definition`)
}
eq(
  orderStatus.ORDER_STATUS_CHOICES.map((v) => orderStatus.ORDER_STATUS[v].label),
  ['Hold', 'Confirmed', 'Closed', 'Canceled'],
  'and the labels the crew asked for',
)
// Four distinct colours, or the coding says nothing.
eq(
  new Set(orderStatus.ORDER_STATUS_CHOICES.map(orderStatus.orderStatusColor)).size,
  4,
  'no two statuses share a colour',
)
ok(orderStatus.isCanceledStatus('canceled'), 'canceled is canceled')
ok(!orderStatus.isCanceledStatus('hold'), 'a hold is not')
ok(
  orderStatus.orderStatusColor('nonsense') === orderStatus.ORDER_STATUS.draft.calendar,
  'an unknown status still gets a colour rather than an undefined',
)
ok(/^#[0-9a-f]{6}$/i.test(orderStatus.NO_STATUS_COLOR), 'a shoot with no job has a neutral colour')
{
  const ys = years.yearsFor(2026, new Date(Date.UTC(2027, 0, 15)))
  eq(ys[0], 2030, 'the year window slides with the calendar year')
  ok(ys.includes(2026), 'and always contains the year being viewed')
}

// ─────────────────────────────────────────────── a shoot can run several days
// The inclusive range is where off-by-ones live: a Wed→Fri shoot is 3 days, and
// it has to appear in 3 calendar cells and hold its gear on all 3.
eq(setDays.setDays('2026-09-09', '2026-09-11'), ['2026-09-09', '2026-09-10', '2026-09-11'], 'both ends are included')
eq(setDays.setDays('2026-09-09', '2026-09-09'), ['2026-09-09'], 'one day is one day')
eq(setDays.setDays('2026-09-09', ''), ['2026-09-09'], 'a missing end means one day')
eq(setDays.setDays('2026-09-09', '2026-09-01'), ['2026-09-09'], 'and a backwards range never books days before the start')
eq(setDays.setDays('', '2026-09-11'), [], 'no start, no shoot')
eq(setDays.setDays('2026-12-30', '2027-01-02').length, 4, 'the range crosses a year')
eq(setDays.setDays('2026-02-27', '2026-03-01').length, 3, 'and a month end')
eq(setDays.setSpanDays('2026-09-09', '2026-09-11'), 3, 'the span is the day count')
eq(
  setDays.setSpanDays('2026-09-09', '2026-09-11'),
  estimate.billableDays('2026-09-09', '2026-09-11'),
  'what a shoot occupies is what it bills — the two rules must agree',
)
eq(setDays.setDays('2026-01-01', '2030-01-01').length, setDays.MAX_SET_DAYS, 'a mistyped year is clamped, not rendered')
ok(setDays.coversDay('2026-09-09', '2026-09-11', '2026-09-10'), 'a middle day is covered')
ok(!setDays.coversDay('2026-09-09', '2026-09-11', '2026-09-12'), 'the day after is not')
ok(!setDays.coversDay('2026-09-09', '', '2026-09-10'), 'a one-day set covers only its own day')
ok(setDays.windowsOverlap({ from: '2026-09-09', to: '2026-09-11' }, { from: '2026-09-11' }), 'touching ranges overlap')
ok(!setDays.windowsOverlap({ from: '2026-09-09', to: '2026-09-10' }, { from: '2026-09-11' }), 'adjacent ones do not')
eq(setDays.endsOnFor('2026-09-09', ''), '2026-09-09', 'an empty end resolves to the start')
{
  // Capacity is per studio per DAY: a 3-day job must clear every day it covers,
  // and the caller has to be told WHICH day is full.
  const busy = { '2026-09-10': 5 }
  const countOn = (iso) => busy[iso] ?? 1
  eq(setDays.firstFullDay('2026-09-09', '2026-09-11', countOn, 5), '2026-09-10', 'names the full day inside the range')
  eq(setDays.firstFullDay('2026-09-09', '2026-09-09', countOn, 5), null, 'a day with room passes')
  eq(setDays.firstFullDay('2026-09-11', '2026-09-12', countOn, 5), null, 'and a range that misses it passes')
}
eq(setDays.spanLabel('2026-09-09', '2026-09-09'), 'Sep 9', 'one day reads as one date')
eq(setDays.spanLabel('2026-09-09', '2026-09-11'), 'Sep 9 – 11', 'a span inside one month says the month once')
eq(setDays.spanLabel('2026-09-29', '2026-10-01'), 'Sep 29 – Oct 1', 'across months it says both')
eq(setDays.spanSummary('2026-09-09', '2026-09-11'), '3 days · Sep 9 – 11', 'the summary leads with how long')
eq(setDays.spanSummary('2026-09-09', '2026-09-09'), 'Sep 9', 'and says nothing extra for one day')
{
  // The estimate and both documents follow the window, not the first day.
  const wide = { ...job, endsOn: '2026-09-12' }
  const e3 = estimate.buildEstimate(wide, { inventory })
  eq(e3.days, 3, 'three days on the job')
  eq(e3.total, 540, 'and the estimate bills all three')
  const t = bytes(packingPdf.buildPackingListPdf(e3, { booking, inventory }))
  ok(t.includes('Shoot dates'), 'the packing list says dates, plural, for a multi-day shoot')
  ok(t.includes('2026-09-10') || t.includes('to  2026-09-12') || t.includes('2026-09-12'), 'and prints the window')
}

// ─────────────────────────────────────────────── call times and the wrap
// A shoot has no single start: roles are called at different hours, the list is
// of unknown length, and it is allowed to be empty.
{
  const raw = [
    { roles: ['Model', 'Stylist'], time: '10:00' },
    { roles: ['Photographer', 'Photographer', ' Digital tech '], time: '08:00' },
    { roles: [], time: '07:00' }, // a row someone opened and left
    { roles: ['Crew'], time: '' }, // ditto
    { roles: ['Producer'], time: '25:00' }, // a typo, not a time
  ]
  const clean = callTimes.normalizeCallTimes(raw)
  eq(clean.length, 2, 'half-filled rows are dropped, not stored as blank lines')
  eq(clean[0].time, '08:00', 'the day comes back in order')
  eq(clean[0].roles, ['Photographer', 'Digital tech'], 'roles are trimmed and de-duplicated')
  eq(clean[1].roles, ['Model', 'Stylist'], 'one call can name several roles')
  eq(clean.map((c) => c.position), [0, 1], 'positions are re-numbered after the sort')
}
{
  // Reported from a job card: "08:15 Producer" printed twice. Two rows saying
  // the same thing at one time are one call.
  const dupes = callTimes.normalizeCallTimes([
    { roles: ['Producer'], time: '08:15' },
    { roles: ['Producer'], time: '08:15' },
  ])
  eq(dupes.length, 1, 'the same call typed twice is one line')
  eq(dupes[0].roles, ['Producer'], 'and it keeps its role')

  const sameTime = callTimes.normalizeCallTimes([
    { roles: ['Model'], time: '10:00' },
    { roles: ['Stylist', 'Model'], time: '10:00' },
  ])
  eq(sameTime.length, 1, 'one time, one line')
  eq(sameTime[0].roles, ['Model', 'Stylist'], 'with the roles unioned, not repeated')

  const noted = callTimes.normalizeCallTimes([
    { roles: ['Crew'], time: '06:45', note: 'freight door' },
    { roles: ['Client'], time: '06:45', note: 'park on 9th' },
  ])
  eq(noted.length, 2, 'but two different notes at one time stay two lines')
  eq(noted.map((r) => r.position), [0, 1], 'and both keep a position')
}
{
  // Reported: a photographer added in People did not appear in the job form's
  // picker — three surfaces asked three different questions and two of them
  // read a frozen list.
  const roster = [
    { name: 'Priya Nair', category: 'Freelancer', subcategory: 'Photographer' },
    { name: 'Ann Taylor', category: 'Freelancer', subcategory: 'Photographer' },
    { name: 'Dana Ruiz', category: 'Freelancer', subcategory: 'Assistant' },
    { name: 'Old Hand', category: 'Freelancer', subcategory: 'Photographer', archivedAt: '2026-01-01' },
    { name: '   ', category: 'Freelancer' },
  ]
  const names = peopleOptions.peopleNames(roster, { role: 'Photographer', used: ['Guest Shooter', ''] })
  eq(names.slice(0, 2), ['Ann Taylor', 'Priya Nair'], 'the trade comes first, in name order')
  ok(names.includes('Dana Ruiz'), 'and nobody on the roster is hidden — that was the bug')
  ok(names.indexOf('Dana Ruiz') > names.indexOf('Priya Nair'), 'the rest follow the photographers')
  ok(names.includes('Guest Shooter'), 'a name already written on a job stays offerable')
  ok(!names.includes('Old Hand'), 'a retired person is not offered')
  eq(names.filter((n) => !n.trim()).length, 0, 'and a blank row is not a person')
  eq(peopleOptions.peopleNames([], {}), [], 'an empty roster offers nothing')
  eq(
    peopleOptions.peopleNames([{ name: 'Mia Speicher', category: 'Model' }], { role: 'Model' }),
    ['Mia Speicher'],
    'a model is a CATEGORY, not a subcategory',
  )
  const twice = peopleOptions.peopleNames(roster, { role: 'Photographer', used: ['Ann Taylor'] })
  eq(twice.filter((n) => n === 'Ann Taylor').length, 1, 'a name used on a job is not offered twice')
}

{
  // The brand list was built from the register ALONE, so it was empty until
  // someone typed one — reported as a broken dropdown.
  eq(orderSearch.BRANDS, ['Ann Taylor', 'Loft'], 'the brands the studio shoots for are offered')
  eq(orderSearch.brandsIn([]), ['Ann Taylor', 'Loft'], 'even on a register that carries none')
  const withOwn = orderSearch.brandsIn([{ brand: 'Zara' }, { brand: 'Loft' }])
  eq(withOwn, ['Ann Taylor', 'Loft', 'Zara'], 'and a brand already in use joins them once')
}
eq(callTimes.normalizeCallTimes([]), [], 'no call times is a valid shoot')
eq(callTimes.normalizeCallTimes(), [], 'and so is nothing at all')
eq(callTimes.toHHMM('08:00:00'), '08:00', 'a Postgres time reads back as HH:MM')
eq(callTimes.toHHMM('8:05'), '08:05', 'and a single-digit hour is padded')
eq(callTimes.toHHMM(null), '', 'null is not a time')
ok(callTimes.isValidTime('00:00') && callTimes.isValidTime('23:59'), 'both ends of the clock are valid')
ok(!callTimes.isValidTime('24:00') && !callTimes.isValidTime('7:5') && !callTimes.isValidTime(''), 'these are not')

// ───────────────────────────────── typing a time, without typing the colon
// The field offers a two-column list, but it stays typeable — and nobody should
// have to reach for the colon. Read the way a clock is read.
for (const [typed, want] of [
  ['8', '08:00'],
  ['08', '08:00'],
  ['830', '08:30'],
  ['0830', '08:30'],
  ['8:5', '08:05'],
  ['8:30', '08:30'],
  ['19.45', '19:45'],
  ['7 15', '07:15'],
  ['2359', '23:59'],
  ['0', '00:00'],
  // A Postgres `time` pasted into the field means what it says.
  ['08:00:00', '08:00'],
]) {
  eq(callTimes.parseTimeInput(typed), want, `"${typed}" reads as ${want}`)
}
// Unreadable text returns '' so the caller LEAVES IT ALONE — overwriting a typo
// with a guess hides it instead of fixing it.
// Four fields is not a time: reading its first two would invent a value out of
// junk, which is worse than refusing it.
for (const bad of ['24:00', '08:75', '99', 'abc', '', null, undefined, '1:2:3:4']) {
  eq(callTimes.parseTimeInput(bad), '', `${JSON.stringify(bad)} is not a time`)
}
// The arrows nudge without retyping, and the day wraps at midnight.
eq(callTimes.stepTime('08:00', 5), '08:05', '+5 minutes')
eq(callTimes.stepTime('08:00', -5), '07:55', '-5 minutes')
eq(callTimes.stepTime('23:55', 5), '00:00', 'past midnight wraps to the start of the day')
eq(callTimes.stepTime('00:00', -5), '23:55', 'and back the other way')
eq(callTimes.stepTime('', 5, '08:00'), '08:00', 'an empty field lands on the fallback, not on 00:05')
eq(callTimes.stepTime('nonsense', 5, '08:00'), '08:00', 'and so does junk')
// What the two columns offer.
eq(callTimes.hourOptions().length, 24, 'every hour of the day')
eq(callTimes.hourOptions()[0], '00', 'zero-padded')
eq(callTimes.hourOptions()[23], '23', 'through 23')
eq(callTimes.minuteOptions(5).length, 12, 'minutes on the 5s')
eq(callTimes.minuteOptions(15), ['00', '15', '30', '45'], 'or on the quarter hour')
eq(callTimes.minuteOptions(5)[1], '05', 'zero-padded too')
ok(
  callTimes.minuteOptions(5).every((m) => callTimes.isValidTime(`08:${m}`)),
  'and every offered minute makes a valid time',
)

// ---------------------------------------------------------------------------
// lib/taxonomy — categories hold subcategories, an item belongs to a
// subcategory, and the two removal rules.
{
  const tax = {
    categories: [
      { id: 'c-strobes', name: 'Strobes', position: 1 },
      { id: 'c-mod', name: 'Lighting Modification', position: 2 },
      { id: 'c-empty', name: 'Stands', position: 5 },
      { id: 'c-gone', name: 'Retired', position: 6, archivedAt: '2026-09-01' },
    ],
    subcategories: [
      { id: 's-pro-strobe', categoryId: 'c-strobes', name: 'Profoto', position: 1 },
      { id: 's-bron', categoryId: 'c-strobes', name: 'Broncolor', position: 2 },
      // The SAME name under another category — the case a text column could not
      // express, and the reason a subcategory is a row with an owner.
      { id: 's-pro-mod', categoryId: 'c-mod', name: 'Profoto', position: 1 },
      { id: 's-old', categoryId: 'c-mod', name: 'Retired kind', archivedAt: '2026-09-01' },
    ],
  }
  const items = [
    { id: 'i1', name: 'D2 head', subcategoryId: 's-pro-strobe' },
    { id: 'i2', name: 'Siros L', subcategoryId: 's-bron' },
    { id: 'i3', name: 'Softbox', subcategoryId: 's-pro-mod' },
    { id: 'i4', name: 'C-stand', category: 'Stands' }, // no subcategory at all
    { id: 'i5', name: 'Old head', subcategoryId: 's-pro-strobe', archivedAt: '2026-08-01' },
  ]

  eq(taxonomy.liveCategories(tax).map((c) => c.name),
    ['Strobes', 'Lighting Modification', 'Stands'], 'archived categories are not offered')
  eq(taxonomy.liveCategories(tax)[0].name, 'Strobes', 'and they keep the studio’s own order')
  eq(taxonomy.liveSubcategories(tax, 'c-mod').map((s) => s.name), ['Profoto'],
    'an archived subcategory is not offered either')

  // The derivation: an item names a subcategory, the category comes from it.
  eq(taxonomy.categoryOf(items[0], tax)?.name, 'Strobes', 'category derived through the subcategory')
  eq(taxonomy.categoryOf(items[2], tax)?.name, 'Lighting Modification',
    'the same subcategory NAME under another category resolves to that one')
  eq(taxonomy.categoryOf(items[3], tax), null, 'an unassigned item has no category — not a guessed one')
  eq(taxonomy.subcategoryPath(taxonomy.subcategoryById(tax, 's-pro-mod'), tax),
    'Lighting Modification / Profoto', 'a subcategory reads with its category')

  // Two identically named subcategories must both be pickable, distinctly.
  const opts = taxonomy.subcategoryOptions(tax)
  eq(opts.filter((o) => o.name === 'Profoto').length, 2, 'both Profotos are offered')
  eq(new Set(opts.map((o) => o.label)).size, opts.length, 'and every option label is distinct')

  // Counting.
  eq(taxonomy.itemsInCategory(items, tax, 'c-strobes').map((i) => i.id), ['i1', 'i2'],
    'a category counts the items of its subcategories, live only')
  eq(taxonomy.itemsInSubcategory(items, 's-pro-strobe').map((i) => i.id), ['i1'],
    'archived stock is not attached')
  eq(taxonomy.unassignedItems(items).map((i) => i.id), ['i4'], 'unassigned is a real state')
  eq(taxonomy.unassignedByFormerCategory(items)[0].former, 'Stands',
    'and it remembers the text it was imported with, as a hint')

  const tree = taxonomy.taxonomyTree(tax, items)
  eq(tree.length, 3, 'the tree lists every live category, empty ones included')
  eq(tree[0].itemCount, 2, 'with its stock counted through its subcategories')
  eq(tree.find((c) => c.id === 'c-empty').subs.length, 0, 'a category with no subcategories still shows')

  // RULE: a category goes only when it has no stock AND no subcategories.
  ok(taxonomy.categoryRemovalBlock('c-strobes', tax, items)?.includes('2 items'),
    'a category holding stock cannot be removed, and says how much')
  ok(taxonomy.categoryRemovalBlock('c-strobes', tax, items)?.includes('2 subcategories'),
    'and names the subcategories in the way')
  eq(taxonomy.categoryRemovalBlock('c-empty', tax, items), null,
    'an empty category can be removed')
  {
    // Stock gone, subcategories left: still blocked, and it says which.
    const emptied = items.filter((i) => i.subcategoryId !== 's-pro-strobe' && i.subcategoryId !== 's-bron')
    const why = taxonomy.categoryRemovalBlock('c-strobes', tax, emptied)
    ok(why?.includes('Profoto') && why?.includes('Broncolor'), 'the reason names them')
  }

  // RULE: a subcategory goes only when it has no stock.
  ok(taxonomy.subcategoryRemovalBlock('s-pro-strobe', tax, items)?.includes('1 item'),
    'a subcategory holding stock cannot be removed')
  eq(taxonomy.subcategoryRemovalBlock('s-bron', tax, items.filter((i) => i.id !== 'i2')), null,
    'once empty it can')
  // Retired stock does not block it — but it is said out loud.
  eq(taxonomy.subcategoryRemovalBlock('s-pro-strobe', tax, items.filter((i) => i.id !== 'i1')), null,
    'archived stock alone does not block removal')
  ok(taxonomy.subcategoryRemovalNote('s-pro-strobe', items)?.includes('1 archived item'),
    'and the archived record is reported instead')
  eq(taxonomy.subcategoryRemovalNote('s-bron', items), null, 'no note when there is nothing to say')

  // Naming.
  ok(taxonomy.categoryNameError('  ', tax), 'a category needs a name')
  ok(taxonomy.categoryNameError('strobes', tax)?.includes('Strobes'),
    'a duplicate category is refused case-insensitively')
  eq(taxonomy.categoryNameError('Strobes', tax, { exceptId: 'c-strobes' }), null,
    'renaming a category to its own name is fine')
  eq(taxonomy.categoryNameError('Retired', tax), null,
    'a name freed by archiving can be used again')
  ok(taxonomy.subcategoryNameError('profoto', tax, 'c-strobes'),
    'a duplicate subcategory within one category is refused')
  eq(taxonomy.subcategoryNameError('Profoto', tax, 'c-empty'), null,
    'but the same name under a DIFFERENT category is allowed')
  ok(taxonomy.subcategoryNameError('Anything', tax, null)?.includes('category'),
    'a subcategory with no category is refused — that is the invariant')
}

// Building a taxonomy from the legacy text — the seed's job, and the SQL
// migration's, so the rule is asserted once here.
{
  const rows = [
    { id: 'a', category: 'Strobes', subcategory: 'Profoto' },
    { id: 'b', category: 'Strobes', subcategory: 'profoto' }, // same, differently typed
    { id: 'c', category: 'Lighting Modification', subcategory: 'Profoto' },
    { id: 'd', category: 'Stands' }, // a category with no subcategory
    { id: 'e', category: '', subcategory: 'Nowhere' }, // no category at all
    { id: 'f', category: 'Retired', subcategory: 'Old', archivedAt: '2026-01-01' },
  ]
  const built = taxonomy.taxonomyFromItems(rows, { order: ['Strobes', 'Stands'] })
  eq(built.categories.map((c) => c.name), ['Strobes', 'Stands', 'Lighting Modification'],
    'categories come out in the given order, unknown ones after')
  eq(built.subcategories.length, 2, 'the pair is the key: one Profoto per category')
  eq(built.assignments.a, built.assignments.b, 'a case variant is the same subcategory')
  ok(built.assignments.a !== built.assignments.c, 'but the other category gets its own')
  eq(built.assignments.d, undefined, 'an item with no subcategory is left unassigned')
  eq(built.categories.find((c) => c.name === 'Retired'), undefined,
    'archived stock does not shape the taxonomy')
  eq(taxonomy.categoryOf({ subcategoryId: built.assignments.c }, built)?.name,
    'Lighting Modification', 'and the result derives back correctly')
}

// The demo register's second level must stay inside the SUBCATEGORIES map: that
// constant has no code consumer any more (the taxonomy is real rows now), so
// without this it would drift out of agreement with the seed silently.
{
  const { SUBCATEGORIES, INVENTORY_SEED } = inventoryData
  const filed = INVENTORY_SEED.filter((i) => i.subcategory)
  ok(filed.length > 30, 'most of the demo register is filed')
  const strays = filed.filter((i) => !(SUBCATEGORIES[i.category] ?? []).includes(i.subcategory))
  eq(strays.map((i) => `${i.name}: ${i.category}/${i.subcategory}`), [],
    'every seeded subcategory is one SUBCATEGORIES lists for that category')
  const unfiled = INVENTORY_SEED.filter((i) => !i.subcategory)
  ok(unfiled.length >= 1, 'and some stock is deliberately left unfiled — that state is real')
}

// ---------------------------------------------------------------------------
// lib/unitRows — one row per physical copy: blanks are generated, typed values
// are the label on the piece in hand, and no number is ever handed out twice.
{
  const taken = new Set(['0700', '0701'])

  // Blank rows take the next free numbers, skipping what the register holds.
  {
    const { codes } = unitRows.resolveUnitCodes([{}, {}, {}], { taken, nextBarcode: '0700' })
    eq(codes, ['0702', '0703', '0704'], 'blank rows skip barcodes already in use')
  }

  // A typed number is honoured, and the blanks route around it.
  {
    const { codes } = unitRows.resolveUnitCodes(
      [{ barcode: '0703' }, {}, {}],
      { taken, nextBarcode: '0702' },
    )
    eq(codes, ['0703', '0702', '0704'], 'a blank row never takes a number typed in another row')
  }

  // The two refusals. Neither invents a substitute — a barcode is a label on a
  // physical piece of gear.
  eq(
    unitRows.resolveUnitCodes([{ barcode: '0700' }], { taken }).error,
    '#0700 is already used by another unit.',
    'a barcode the register already holds is refused',
  )
  eq(
    unitRows.resolveUnitCodes([{ barcode: '0900' }, { barcode: '0900' }], { taken }).error,
    '#0900 is listed twice — each unit needs its own barcode.',
    'two rows claiming one barcode are refused',
  )
  ok(!unitRows.resolveUnitCodes([{ barcode: '0900' }, {}], { taken }).error,
    'and one typed row is fine')

  // Serials ride along untouched; the caller supplies its own generator.
  {
    const { specs } = unitRows.resolveUnitCodes([{ serial: ' SN-1 ' }, {}], { taken, nextBarcode: '0800' })
    eq(specs[0].serial, 'SN-1', 'a typed serial is trimmed and kept')
    eq(specs[1].serial, '', 'a blank one is left for the caller to generate')
  }

  // `count` is the "just give me N" shorthand the old API took.
  eq(unitRows.resolveUnitCodes([], { taken, nextBarcode: '0710', count: 2 }).codes,
    ['0710', '0711'], 'a bare count still means that many generated')
  eq(unitRows.normalizeUnitRows([], 3).length, 3, 'and normalizes to that many rows')
  eq(unitRows.normalizeUnitRows(Array.from({ length: 99 }, () => ({})), 1).length,
    unitRows.MAX_UNIT_ROWS, 'the row count is capped')

  // The greyed previews must agree with what the save will do — the whole point
  // of sharing this module.
  {
    const rows = [{ barcode: '0703' }, {}, {}]
    const previews = unitRows.barcodePreviews(rows, '0702', taken)
    const { codes } = unitRows.resolveUnitCodes(rows, { taken, nextBarcode: '0702' })
    eq(previews, [null, '0702', '0704'], 'a typed row previews nothing, blanks preview their number')
    eq(previews.map((p, i) => p ?? rows[i].barcode), codes,
      'and every preview is the code the save actually assigns')
  }
  eq(unitRows.barcodePreviews([{}, {}], undefined), ['0001', '0002'],
    'with no suggestion it starts at 0001 rather than NaN')

  eq(unitRows.duplicateTypedBarcode([{ barcode: '0900' }, { barcode: '0900' }]), '0900',
    'the form catches the duplicate next to the field')
  eq(unitRows.duplicateTypedBarcode([{ barcode: '0900' }, {}, {}]), null, 'blanks never collide')
}

// The DATE filter on Jobs. The primitive was asserted; the FILTER was not, and
// two unlabelled date boxes are exactly where a wrong answer hides. A job
// matches when its own shooting window overlaps the asked-for period, and
// either side may be left open.
{
  const dated = [
    { id: 'jul', jobName: 'July', startsOn: '2026-07-31', endsOn: '2026-07-31' },
    { id: 'sep', jobName: 'Sept', startsOn: '2026-09-10', endsOn: '2026-09-10' },
    { id: 'span', jobName: 'Span', startsOn: '2026-08-30', endsOn: '2026-09-02' },
    { id: 'nodate', jobName: 'No dates' },
    // Spans BOTH ends of the backwards range below — the case that proved the
    // "nothing can match" claim false, since each one-sided test passes alone.
    { id: 'straddle', jobName: 'Straddle', startsOn: '2026-09-10', endsOn: '2026-09-11' },
  ]
  const found = (c) => orderSearch.searchOrders(dated, c).map((o) => o.id).sort()

  eq(found({ from: '2026-09-01' }), ['sep', 'span', 'straddle'], '`from` alone means on or after')
  eq(found({ to: '2026-08-01' }), ['jul'], '`to` alone means on or before')
  eq(found({ from: '2026-07-01', to: '2026-08-31' }), ['jul', 'span'], 'a period matches what overlaps it')
  // A multi-day job must be found from EITHER end of its span.
  eq(found({ from: '2026-09-02', to: '2026-09-02' }), ['span'], 'a span is found from its last day')
  eq(found({ from: '2026-09-10', to: '2026-09-11' }), ['sep', 'straddle'], 'and a straddling job is found by a real period')
  eq(found({ from: '2026-08-30', to: '2026-08-30' }), ['span'], 'and from its first')
  ok(!found({ from: '2026-01-01', to: '2026-12-31' }).includes('nodate'),
    'a job with no dates cannot satisfy a date filter')
  eq(found({}), ['jul', 'nodate', 'sep', 'span', 'straddle'], 'and with no dates asked, everything stays')

  // The reported case: two boxes, the second earlier than the first.
  // Including the job that covers BOTH of its ends — an empty interval holds
  // no days, so the warning beside the fields is literally true.
  eq(found({ from: '2026-09-11', to: '2026-09-10' }), [], 'a backwards period matches nothing, not even a job straddling it')
  ok(orderSearch.rangeIsBackwards('2026-09-11', '2026-09-10'), 'which the UI names instead of just emptying')
  ok(!orderSearch.rangeIsBackwards('2026-09-10', '2026-09-11'), 'a normal period is not flagged')
  ok(!orderSearch.rangeIsBackwards('2026-09-10', '2026-09-10'), 'a single day is not backwards')
  ok(!orderSearch.rangeIsBackwards('', '2026-09-10') && !orderSearch.rangeIsBackwards('2026-09-10', ''),
    'and one open end can never be')
}

// ---------------------------------------------------------------------------
// lib/theme — three states, because a two-way toggle cannot express "follow the
// device" once it has been touched.
{
  eq(theme.resolveTheme('dark', false), 'dark', 'an explicit dark wins over a light device')
  eq(theme.resolveTheme('light', true), 'light', 'and an explicit light over a dark one')
  eq(theme.resolveTheme('system', true), 'dark', 'system follows the device')
  eq(theme.resolveTheme('system', false), 'light', 'both ways')
  // Anything we do not understand follows the device rather than forcing light:
  // an older build, or a hand-edited localStorage.
  eq(theme.resolveTheme(undefined, true), 'dark', 'an absent preference follows the device')
  eq(theme.resolveTheme('midnight', true), 'dark', 'so does a value from the future')
  eq(theme.resolveTheme(null, false), 'light', 'and null is not a crash')

  eq(theme.nextTheme('system'), 'light', 'the cycle runs System → Light')
  eq(theme.nextTheme('light'), 'dark', '→ Dark')
  eq(theme.nextTheme('dark'), 'system', 'and back to System, so it is reachable again')
  eq(theme.nextTheme('nonsense'), 'system', 'a broken value lands on System')
  eq(new Set(theme.THEME_ORDER).size, 3, 'three distinct states')
  ok(theme.THEME_ORDER.every((t) => theme.THEME_LABEL[t]), 'each one has a label to show')
  ok(theme.isTheme('dark') && !theme.isTheme('darkish'), 'and the guard is exact')
}

// ---------------------------------------------------------------------------
// lib/ordering — a comparator that is TOTAL, so a list cannot reshuffle.
{
  const rows = [
    { id: 'b', on: '2026-07-16' },
    { id: 'a', on: '2026-07-16' },
    { id: 'c', on: '2026-07-20' },
  ]
  const newest = ordering.newestFirst('on')
  const once = [...rows].sort(newest).map((r) => r.id).join('')
  const twice = [...rows].sort(newest).sort(newest).map((r) => r.id).join('')
  eq(once, 'cab', 'newest first, and equal dates fall back to the id')
  eq(twice, once, 'sorting an already-sorted list changes nothing')
  // The bug this replaced: `(a, b) => (a.on < b.on ? 1 : -1)` answers -1 both
  // ways for an equal pair, so every re-sort swapped it — and this store
  // re-sorts on every write.
  const broken = (a, b) => (a.on < b.on ? 1 : -1)
  ok(
    broken(rows[0], rows[1]) === broken(rows[1], rows[0]),
    'the old comparator claims BOTH orders for one pair, which is what swapped them',
  )
  eq(newest(rows[0], rows[1]) + newest(rows[1], rows[0]), 0, 'the new one is antisymmetric')
  eq([...rows].sort(ordering.oldestFirst('on')).map((r) => r.id).join(''), 'bac', 'and it reverses cleanly')
  // A missing field must not throw or reorder randomly.
  const partial = [{ id: 'x' }, { id: 'y', on: '2026-01-01' }]
  eq([...partial].sort(newest).map((r) => r.id).join(''), 'yx', 'a row with no date sorts last, deterministically')
}

// ---------------------------------------------------------------------------
// lib/patch — a partial write must not blank the columns it said nothing about.
{
  const MAP = { brand: 'brand', assetType: 'asset_type', notes: 'notes' }
  const only = patch.pickPatch({ notes: 'a thought' }, MAP)
  eq(Object.keys(only).join(','), 'notes', 'a notes-only patch touches ONLY notes')
  eq(only.notes, 'a thought', 'and carries it')
  // The bug this replaced: the item mapper emitted every column it knew, so
  // saving one field wrote null over five others — on the real database only,
  // because local mode guards its own list with `in`.
  const whole = patch.pickPatch({ brand: 'Profoto', assetType: '', notes: null }, MAP)
  eq(whole.brand, 'Profoto', 'a supplied value is written')
  eq(whole.asset_type, null, "an empty string CLEARS the column")
  eq(whole.notes, null, 'and so does an explicit null')
  eq(Object.keys(patch.pickPatch({}, MAP)).length, 0, 'nothing supplied writes nothing at all')
}

// ───────────────────────────────────────── lib/routes — the address bar
// The URL is the one piece of app state a person can type, paste and bookmark,
// so the mapping has to be total in both directions and must not drift from the
// tabs themselves.
{
  const { VIEW_PATHS, pathForView, viewForPath, viewFromLocation, normalizeBase, DEFAULT_VIEW } = routes

  // EVERY tab has an address. Adding one to WORKSPACE_NAV without a path here
  // would otherwise give it the calendar's URL and no way back to it.
  for (const item of nav.WORKSPACE_NAV) {
    ok(VIEW_PATHS[item.id], `the ${item.label} tab has a path of its own`)
  }
  const segs = Object.values(VIEW_PATHS)
  eq(segs.length, new Set(segs).size, 'no two screens share a path')

  // The segment is user-facing text, so it follows the LABEL. The store's view
  // id and the DB table both still say `order`; the address says jobs.
  eq(VIEW_PATHS.orders, 'jobs', 'the Jobs screen is /jobs, not /orders')

  // Round trip at both bases the app is built for: Vercel serves from the root,
  // the dev server (and a Pages build) from a sub-path.
  for (const base of ['/', '/kitbay/']) {
    for (const view of Object.keys(VIEW_PATHS)) {
      const path = pathForView(view, base)
      ok(path.startsWith(base), `${view} at base ${base} keeps the base`)
      ok(!path.includes('//'), `${view} at base ${base} has no doubled slash`)
      eq(viewForPath(path, base), view, `${base} round trip for ${view}`)
    }
  }

  // A base written any of the three plausible ways behaves the same.
  eq(normalizeBase('kitbay'), '/kitbay/', 'a bare base gains both slashes')
  eq(normalizeBase('/kitbay'), '/kitbay/', 'a base gains its trailing slash')
  eq(normalizeBase(''), '/', 'an empty base is the root')

  // A path naming no screen answers NULL rather than guessing — the caller
  // keeps the screen it has and rewrites the address, so a stale or mistyped
  // link lands somewhere real. This app serves no 404 of its own.
  eq(viewForPath('/', '/'), null, 'the root names no screen')
  eq(viewForPath('/nope', '/'), null, 'an unknown path names no screen')
  eq(viewForPath('/jobs', '/kitbay/'), null, 'a path outside the base names no screen')
  eq(viewForPath('/JOBS', '/'), 'orders', 'the address is case-insensitive')
  eq(viewForPath('/jobs/order-7', '/'), 'orders', 'a deeper path still names its screen')

  // Which screen a LOAD opens on: the address wins over what was remembered,
  // and with no address to go on the remembered screen wins over the default.
  eq(viewFromLocation('/inventory', 'orders'), 'inventory', 'an explicit link beats the stored screen')
  eq(viewFromLocation('/', 'orders'), 'orders', 'no screen in the address falls back to the stored one')
  eq(viewFromLocation('/', null), DEFAULT_VIEW, 'and to the default when nothing was stored')
  eq(viewFromLocation('/nope', 'people'), 'people', 'an unknown path falls back, it does not reset')
}

// ──────────────────────────── peopleOptions — the TRADE filter on the roster
// The People screen's category (Freelancer / Model / Agency) is not what anyone
// looks a person up by. The trade is, and it lives one level down.
{
  const CATS = {
    Freelancer: ['Photographer', 'Art director', 'Stylist'],
    Model: [],
    Agency: ['Booker'],
  }
  const roster = [
    { name: 'Ann', category: 'Freelancer', subcategory: 'Photographer' },
    { name: 'Marcus', category: 'Freelancer', subcategory: 'Photographer' },
    { name: 'Iris', category: 'Freelancer', subcategory: 'Stylist' },
    { name: 'Ava', category: 'Model', subcategory: '' },
    { name: 'Bea', category: 'Agency', subcategory: 'Booker' },
    { name: 'Zed', category: 'Freelancer', subcategory: 'Drone pilot' }, // typed, not in CATS
  ]

  const all = peopleOptions.subcategoriesIn(roster, 'All', CATS)
  eq(all, ['Photographer', 'Stylist', 'Booker', 'Drone pilot'], 'every trade on the roster, taxonomy order first')
  ok(!all.includes('Art director'), 'a trade nobody has is NOT offered — the empty-option lesson')
  eq(all.filter((s) => s === 'Photographer').length, 1, 'a trade two people share is offered once')

  eq(
    peopleOptions.subcategoriesIn(roster, 'Freelancer', CATS),
    ['Photographer', 'Stylist', 'Drone pilot'],
    'narrowed to the chosen category',
  )
  eq(peopleOptions.subcategoriesIn(roster, 'Agency', CATS), ['Booker'], 'and to a category with one')
  // Models carry no trade at all (Model IS the trade), so the dropdown has
  // nothing to offer and the component hides it rather than showing an empty one.
  eq(peopleOptions.subcategoriesIn(roster, 'Model', CATS), [], 'a category whose people have no trade offers none')
  eq(peopleOptions.subcategoriesIn([], 'All', CATS), [], 'an empty roster offers nothing')
  eq(peopleOptions.subcategoriesIn(undefined, undefined, undefined), [], 'and nothing at all is survivable')
}

// ─────────────────────────────── activity — a job edit names fields in WORDS
// The feed printed the form's keys verbatim ("setLabel, jobType"). It reads the
// same words as the job card now, and an edit logged before that still does,
// because the words are applied when the event is read.
{
  const words = activity.jobFieldWords
  eq(words(['setLabel', 'jobType']), ['set name', 'shoot type'], 'the renamed fields read as their new labels')
  eq(words(['startsOn', 'endsOn']), ['shoot dates'], 'both ends of the dates are ONE field on screen, named once')
  eq(words(['notes']), ['note'], 'the note is still called Note')
  eq(words(['jobName', 'studioId']), ['shoot name', 'location / studio'], 'the name and place read as their labels now')
  eq(words(['someNewField']), ['some new field'], 'an unmapped key still reads as words, never camelCase')
  eq(words(undefined), [], 'nothing survivable')
  const d = activity.describeEvent({ type: activity.EVENT.ORDER_UPDATED, data: { changed: ['setLabel', 'jobType'] } })
  eq(d.detail, 'set name, shoot type', 'and that is what the feed shows')
  ok(!/[a-z][A-Z]/.test(d.detail), 'with no camelCase in it')
}

// ──────────────────────────── studios — L is LOCATION, and it has an address
// Settled with the studio: the sixth row was never "a large studio", it is where
// shoots OUTSIDE the studio's own rooms go, and those need an address.
{
  const { studioLabel, placeLabel, STUDIOS, LOCATION_STUDIO } = studios
  eq(studioLabel('L'), 'Location', 'L reads as Location, not "Studio L"')
  eq(studioLabel('3'), 'Studio 3', 'a room is still a studio')
  ok(STUDIOS.includes(LOCATION_STUDIO), 'L is still a calendar row — its id is the row key')
  eq(placeLabel('L', 'Pier 59 / Studio 101'), 'Location · Pier 59 / Studio 101', 'a location shoot names its place')
  eq(placeLabel('L', '   '), 'Location', 'with no address yet it just says Location')
  eq(placeLabel('3', 'Pier 59'), 'Studio 3', 'an address never rides on a studio shoot')
  eq(placeLabel(null, 'Pier 59'), null, 'no studio, nothing to say')

  // The address is words, so the job search finds it.
  const pool = [
    { id: 'a', jobName: 'A', studioId: 'L', location: 'Pier 59 / Studio 101', startsOn: '2026-10-01', endsOn: '2026-10-01' },
    { id: 'b', jobName: 'B', studioId: '2', startsOn: '2026-10-01', endsOn: '2026-10-01' },
  ]
  eq(orderSearch.searchOrders(pool, { text: 'pier 59' }).map((o) => o.id), ['a'], 'a job is found by its address')

  // Both PDFs print it — and a long one WRAPS instead of running off the page.
  // ASCII on purpose, so the PDF's own text strings can be measured as written.
  const long =
    'Pier 59 / Studio 101, Chelsea Piers, 23rd Street at the Hudson River, New York, NY 10011, use loading dock B'
  const lEst = estimate.buildEstimate({ ...job, studioId: 'L', location: long }, { inventory })
  const { jsPDF } = await import('jspdf')
  const probe = new jsPDF({ unit: 'pt' })
  probe.setFont('helvetica', 'bold')
  probe.setFontSize(9)
  const COLUMN = 595.28 - 48 - (48 + 100) // page width − right margin − where values start
  for (const [label, doc] of [
    ['estimate', estimatePdf.buildEstimatePdf(lEst)],
    ['packing list', packingPdf.buildPackingListPdf(lEst, { booking, inventory })],
  ]) {
    const t = bytes(doc)
    ok(t.includes('Location / Studio'), `${label}: the row is called Location / Studio`)
    const frags = [...t.matchAll(/\(([^()]*)\) Tj/g)]
      .map((m) => m[1])
      .filter((f) => /Pier 59|Chelsea|Hudson|NY 10011|loading dock/.test(f))
    ok(frags.length >= 2, `${label}: a long address wraps onto more than one line`)
    ok(frags.every((f) => probe.getTextWidth(f) <= COLUMN), `${label}: and no line of it runs past the margin`)
    ok(frags.join(' ').includes('loading dock B'), `${label}: nothing at the end of it is cut off`)
  }
  const studioJob = estimate.buildEstimate({ ...job, studioId: '2', location: 'Pier 59' }, { inventory })
  ok(!bytes(estimatePdf.buildEstimatePdf(studioJob)).includes('Pier 59'), 'a studio job prints no stale address')
}

// ──────────────────────────── vocabulary — one name per thing
// The same thing kept picking up a second name, one string at a time: the item
// was "Add inventory" beside "Edit item", a job was still an "order" in half a
// dozen messages, the People screen counted "contacts", the packing list was
// also a "pull sheet" and a "packing checklist". Each was a single string nobody
// re-read. So this walks EVERY string a person can see — JSX text, attributes
// (title, placeholder, aria-label…), string and template literals — and fails on
// the retired words. It is a list of WORDS, not of screens: a screen written
// tomorrow is covered the day it is written.
// Parsed with rolldown's parser (Vite's own, already installed), so nothing is
// added to the project. Archive.jsx is skipped: it is unrouted and never renders.
{
  const { parseAst } = await import('rolldown/parseAst')
  const { readdirSync, readFileSync } = await import('node:fs')
  const RETIRED = [
    [/\borders?\b/i, 'the record is a Job on screen (the table keeps its name)'],
    [/\bbookings?\b/i, 'the day is a Shoot'],
    [/\bcontacts\b/i, 'people are People — "Contact" alone means contact details'],
    [/\bcop(y|ies)\b/i, 'a physical piece is a unit'],
    [/\bpresets?\b/i, 'a preset is a scenario list'],
    [/\bpc\(s\)/, 'pieces are "pcs"'],
    [/\b(pull sheet|packing checklist|digital checklist)\b/i, 'the document is the packing list'],
    [/\b(inventory item|item type|add inventory)\b/i, 'an item is an item — created by "New item"'],
    [/\bStudio L\b/, 'L is Location'],
    [/\broster\b/i, 'the roster is the crew'],
    [/\bplacement\b/i, 'placement is the storage location'],
    [/\bjob name\b/i, 'the field is the Shoot name'],
    [/\bFULFILLED\b/, 'the closed status reads "Closed" — on paper too'],
  ]
  // Only in JSX text, where a lone LOWERCASE word is the noun of a count
  // ("{n} sets"). Case-sensitive on purpose: "Contact" is the contact-details
  // heading, and "set" stays legal elsewhere — "Set name", "not set".
  const JSX_ONLY = [
    [/^(sets?|contacts?)$/, 'a count of shoots says "shoots", of people "people"'],
    [/^(orders?|bookings?)$/, 'a count of jobs says "jobs"'],
  ]
  const files = [
    ...readdirSync('src/components')
      .filter((f) => f.endsWith('.jsx') && f !== 'Archive.jsx')
      .map((f) => `src/components/${f}`),
    ...readdirSync('src/lib').filter((f) => /\.jsx?$/.test(f)).map((f) => `src/lib/${f}`),
    ...readdirSync('src').filter((f) => /\.jsx?$/.test(f)).map((f) => `src/${f}`),
    'src/data/orderStatus.js',
    'src/data/nav.js',
    'src/data/studios.js',
    'src/data/repository.js',
  ]
  // Attributes that hold code, not words.
  const CODE_ATTR = new Set(['className', 'key', 'type', 'href', 'target', 'rel', 'id', 'role', 'name', 'autoComplete', 'inputMode', 'd', 'viewBox', 'fill', 'stroke', 'strokeWidth', 'value'])
  // Words, not identifiers: a column list ("order_id, line_key"), an event type
  // ("order.updated"), an id ("order-7") or a store key ("orders") is code.
  const isWords = (t) =>
    /[A-Za-z]/.test(t) && !/[a-z]_[a-z]/.test(t) && (/\s/.test(t) ? true : !/^[a-z0-9.:{}…/#-]+$/.test(t))
  const hits = []
  let seen = 0
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const ast = parseAst(src, { lang: file.endsWith('.jsx') ? 'jsx' : 'js' })
    const lineOf = (i) => src.slice(0, i).split('\n').length
    const check = (node, raw) => {
      const t = String(raw).replace(/\s+/g, ' ').trim()
      if (!t || !isWords(t)) return
      seen++
      for (const [re, why] of RETIRED) if (re.test(t)) hits.push(`${file}:${lineOf(node.start)} "${t}" — ${why}`)
    }
    const walk = (node, parent) => {
      if (!node || typeof node.type !== 'string') return
      if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') return
      if (node.type === 'JSXAttribute' && CODE_ATTR.has(node.name?.name)) return
      // A developer's console line is not on screen.
      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'MemberExpression' &&
        node.callee.object?.name === 'console'
      )
        return
      if (node.type === 'JSXText') {
        // JSX text is ALWAYS on screen, however short: " set" beside a count is
        // a word, not an identifier — the first version of this scan filtered
        // it out as one and missed "2 sets" in the unit history.
        const t = node.value.replace(/\s+/g, ' ').trim()
        if (t && /[A-Za-z]/.test(t)) {
          seen++
          for (const [re, why] of [...RETIRED, ...JSX_ONLY])
            if (re.test(t)) hits.push(`${file}:${lineOf(node.start)} "${t}" — ${why}`)
        }
      }
      else if (node.type === 'Literal' && typeof node.value === 'string') {
        const isKey = parent?.type === 'Property' && parent.key === node
        const isCompared = parent?.type === 'BinaryExpression' && /[=!]==?/.test(parent.operator)
        if (!isKey && !isCompared) check(node, node.value)
      } else if (node.type === 'TemplateLiteral')
        check(node, node.quasis.map((q) => q.value.cooked ?? q.value.raw).join('{…}'))
      for (const k of Object.keys(node)) {
        const v = node[k]
        if (Array.isArray(v)) for (const c of v) walk(c, node)
        else if (v && typeof v === 'object' && typeof v.type === 'string') walk(v, node)
      }
    }
    walk(ast.program ?? ast, null)
  }
  ok(seen > 1500, `the vocabulary scan read the app's strings (${seen}), not an empty set`)
  eq(hits, [], 'no retired word is left anywhere a person can read it')
  const estText = bytes(estimatePdf.buildEstimatePdf(est))
  ok(estText.includes('CREW') && !estText.includes('ROSTER'), 'the estimate heads its crew section CREW')
  const emptyJob = estimate.buildEstimate({ ...job, lines: [] }, { inventory })
  ok(
    bytes(packingPdf.buildPackingListPdf(emptyJob, { booking, inventory })).includes('No equipment on this job.'),
    'an empty packing list says JOB, not order',
  )
}

// ─────────────────────── status colours — the PDFs wear the app's own pill
// "Колор код привести к общему стандарту": Confirmed green, Canceled red, and
// so on. The estimate printed a word of its own in grey (FULFILLED, for what the
// app calls Closed) and the packing list said CONFIRMED whatever the job was.
// Both now draw the pill every screen draws.
{
  const { jsPDF } = await import('jspdf')
  const { readFileSync } = await import('node:fs')
  // The print colours ARE the pill classes' Tailwind values. Derived here from
  // Tailwind's own theme (oklch -> sRGB), so a class that changes without the
  // PDF fails instead of drifting.
  const theme = readFileSync('node_modules/tailwindcss/theme.css', 'utf8')
  const toRgb = (L, C, H) => {
    const h = (H * Math.PI) / 180
    const a = C * Math.cos(h)
    const b = C * Math.sin(h)
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const q = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * q,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * q,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * q,
    ].map((v) => {
      const c = Math.min(1, Math.max(0, v))
      return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255)
    })
  }
  const tw = (name) => {
    const m = theme.match(new RegExp(`--color-${name}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\)`))
    return m ? toRgb(Number(m[1]) / 100, Number(m[2]), Number(m[3])) : null
  }
  const cls = (classes, prefix) => classes.split(/\s+/).find((c) => c.startsWith(prefix))?.slice(prefix.length)
  for (const [key, meta] of Object.entries(orderStatus.ORDER_STATUS)) {
    const named = { fill: cls(meta.pill, 'bg-'), ink: cls(meta.pill, 'text-'), ring: cls(meta.pill, 'ring-'), dot: cls(meta.dot, 'bg-') }
    for (const [part, name] of Object.entries(named)) {
      const rgb = tw(name)
      ok(
        !!rgb && meta.print[part].every((v, i) => Math.abs(v - rgb[i]) <= 1),
        `${key}: the printed ${part} is ${name}, the pill's own colour`,
      )
    }
  }

  // The fill operator jsPDF writes for a colour, from jsPDF itself — its number
  // formatting is its own business, so the test asks it rather than guessing.
  const fillOp = (rgb) => {
    const d = new jsPDF({ unit: 'pt' })
    d.setFillColor(rgb[0], rgb[1], rgb[2])
    d.rect(0, 0, 1, 1, 'F')
    return bytes(d).match(/[\d.]+ [\d.]+ [\d.]+ rg/)[0]
  }
  for (const status of ['hold', 'confirmed', 'fulfilled', 'canceled']) {
    const meta = orderStatus.orderStatusMeta(status)
    const e = estimate.buildEstimate({ ...job, status }, { inventory })
    for (const [label, doc] of [
      ['estimate', estimatePdf.buildEstimatePdf(e)],
      ['packing list', packingPdf.buildPackingListPdf(e, { booking, inventory })],
    ]) {
      const t = bytes(doc)
      ok(t.includes(`(${meta.label}) Tj`), `${label}: a ${status} job's header says ${meta.label}`)
      ok(t.includes(fillOp(meta.print.fill)), `${label}: in the ${meta.label} pill's own fill`)
    }
  }
  const closed = bytes(estimatePdf.buildEstimatePdf(estimate.buildEstimate({ ...job, status: 'fulfilled' }, { inventory })))
  ok(!closed.includes('FULFILLED'), 'a closed job reads Closed on paper too, never FULFILLED')
  const onHold = estimate.buildEstimate({ ...job, status: 'hold' }, { inventory })
  ok(!bytes(packingPdf.buildPackingListPdf(onHold, { booking, inventory })).includes('CONFIRMED'), 'a packing list for a job on hold no longer says CONFIRMED')
}

// ─────────────────────── set name — a PDP day's, and nobody else's
{
  const { setNameApplies, showsSetName } = orderSearch
  ok(setNameApplies('PDP') && setNameApplies('pdp') && setNameApplies(' PDP '), 'PDP has sets, however it is typed')
  ok(setNameApplies('') && setNameApplies(null) && setNameApplies(undefined), 'a job with no type yet keeps the field (13 of the 20 on prod)')
  ok(!setNameApplies('Editorial') && !setNameApplies('Lookbook'), 'Editorial and any other type have no set name')
  ok(showsSetName({ jobType: 'Editorial', setLabel: 'OMSet1' }), 'a stored name is still SHOWN until the next save clears it')
  ok(!showsSetName({ jobType: 'Editorial', setLabel: '' }), 'an editorial job shows no empty Set name row')
  ok(showsSetName({ jobType: 'PDP', setLabel: '' }), 'a PDP job shows the row even while it is empty')
  const editorial = estimate.buildEstimate({ ...job, jobType: 'Editorial', setLabel: null }, { inventory })
  ok(!bytes(estimatePdf.buildEstimatePdf(editorial)).includes('Set name'), 'an editorial job prints no Set name row')
  ok(!bytes(packingPdf.buildPackingListPdf(editorial, { booking, inventory })).includes('Set name'), 'on either document')
  ok(bytes(estimatePdf.buildEstimatePdf(est)).includes('Set name'), 'a job that has one still prints it')
}

// ─────────────────────── capacity — five shoots a ROOM; Location is not a room
{
  const day = '2026-10-05'
  const five = (studioId) =>
    Array.from({ length: 5 }, (_, i) => ({ id: `${studioId}-${i}`, studioId, status: 'active', date: day, endDate: null }))
  ok(
    (capacity.capacityError(five('1'), { studioId: '1', from: day, to: day }) || '').includes('already has 5 shoots'),
    'a sixth shoot in Studio 1 is refused',
  )
  eq(capacity.capacityError(five('L'), { studioId: 'L', from: day, to: day }), null, 'a sixth LOCATION shoot is not — each is its own venue')
  eq(
    capacity.capacityError(five('1'), { studioId: '1', from: day, to: day, excludeSetId: '1-0' }),
    null,
    'the shoot being edited never counts against itself',
  )
  ok(!capacity.hasDailyCap('L') && capacity.hasDailyCap('3') && !capacity.hasDailyCap(null), 'only the rooms have a daily cap')
  eq(capacity.MAX_SETS_PER_DAY, 5, 'and the cap is still five')
}

// ─────────────── the call sheet — every row a time · role · person
// The studio's design: "10:00 · Producer · Clay Rodriguez", one role and one
// person per row, the photographer just one of the rows. It replaced a
// Photographer field and a list of call times by role (two lists, one crew).
{
  const sheet = crew.normalizeCrew([
    { role: 'Model', name: 'Hailey Halter', time: '10:00' },
    { role: ' Photographer ', name: ' Marcus Reed ', time: '08:00' },
    { role: 'Producer', time: '07:30' },
    { role: 'Client', name: 'Loft team' }, // on the crew, no call yet
    { role: '', name: 'Nobody', time: '09:00' }, // no role: the form refuses it
    { role: 'Producer', time: '07:30' }, // an exact duplicate
  ])
  eq(
    sheet.map(crew.crewLine),
    ['07:30 Producer', '08:00 Photographer · Marcus Reed', '10:00 Model · Hailey Halter', 'Client · Loft team'],
    'the day in order — timed rows by time, the rest after — with duplicates folded and names trimmed',
  )
  eq(sheet.map((r) => r.position), [0, 1, 2, 3], 'positions follow that order')
  eq(crew.crewNameFor(sheet, 'photographer'), 'Marcus Reed', 'the job’s one photographer is read off the sheet, in any case')
  eq(crew.crewNameFor(sheet, 'Stylist'), '', 'a role nobody holds reads as nobody')
  eq(
    crew.firstWithRole([{ role: 'Photographer' }, { role: 'Photographer', name: 'Ann Taylor' }], 'Photographer')?.name,
    'Ann Taylor',
    'the first NAMED row of the role — an empty slot is not the photographer',
  )
  eq(crew.earliestCrewCall(sheet), '07:30', 'the chip shows the earliest call')
  eq(crew.earliestCrewCall([{ role: 'Client', name: 'X' }]), null, 'a sheet with no times has no first call')
  eq(
    crew.crewSummary(sheet),
    '07:30 Producer · 08:00 Photographer (Marcus Reed) · 10:00 Model (Hailey Halter) · Client (Loft team)',
    'the tooltip reads the sheet, a person in brackets',
  )
  ok(crew.wrapBeforeFirstCrewCall(sheet, '07:00'), 'a wrap before the first call is reported')
  ok(!crew.wrapBeforeFirstCrewCall(sheet, '19:00'), 'a normal day is not')
  ok(!crew.wrapBeforeFirstCrewCall([], '07:00'), 'and with no calls there is nothing to contradict')
  eq(crew.crewNames(sheet), ['Marcus Reed', 'Hailey Halter', 'Loft team'], 'every named person, once')
  eq(crew.crewRowProblem({ time: '08:00', name: 'Ann' }), 'Pick a role for this row — or remove it.', 'a row with no role says so')
  eq(crew.crewRowProblem({ role: 'Crew', time: '8:7' }), 'The time should read as HH:MM.', 'and so does a half-typed time')
  eq(crew.crewRowProblem({ role: 'Crew' }), null, 'a role alone is a row: nobody booked, no call yet')
  eq(crew.crewRowProblem({}), null, 'an empty row is fine — it is dropped')
  eq(crew.normalizeCrew([]), [], 'an empty sheet is a real state')
  eq(crew.normalizeCrew(), [], 'and so is nothing at all')
  const roles = crew.crewRoles([{ crew: [{ role: 'Gaffer' }, { role: 'photographer' }] }])
  ok(roles.includes('Gaffer'), 'a typed role stays offered')
  eq(roles.filter((r) => r.toLowerCase() === 'photographer').length, 1, 'and a case twin of an offered one is not added')
  eq(crew.crewRoles([]), callTimes.CALL_ROLES, 'with no shoots, just the studio’s list')
}
{
  // The MIGRATION's rule, written once in JS (20260930120000 applies the same
  // to prod): the roster and the call times → one sheet.
  const merged = crew.crewFromLegacy({
    photographer: 'Marcus Reed',
    model: 'Hailey Halter',
    calls: [
      { roles: ['Producer'], time: '07:30' },
      { roles: ['Photographer', 'Digital tech'], time: '08:00' },
      { roles: ['Model'], time: '10:00', note: 'Glam first' },
    ],
  })
  eq(
    merged.map(crew.crewLine),
    ['07:30 Producer', '08:00 Photographer · Marcus Reed', '08:00 Digital tech', '10:00 Model · Hailey Halter'],
    'a call joins the person it was always about; a role with nobody yet is its own row',
  )
  eq(merged.find((r) => r.role === 'Model').note, 'Glam first', 'and brings its note along')
  // Prod carried "08:15 Producer" twice for one shoot, and a Photographer call
  // whose note held a name — the crew had nowhere else to write it.
  const prodLike = crew.crewFromLegacy({
    photographer: 'Ann Taylor',
    calls: [
      { roles: ['Producer'], time: '08:15' },
      { roles: ['Producer'], time: '08:15' },
      { roles: ['Photographer'], time: '07:15', note: 'Ann Tes' },
    ],
  })
  eq(prodLike.filter((r) => r.role === 'Producer').length, 1, 'the same call typed twice arrives once')
  eq(prodLike[0].name, 'Ann Taylor', 'the photographer takes the 07:15 call')
  eq(prodLike[0].note, 'Ann Tes', 'and what was typed in its note is kept, not guessed at')
  eq(
    crew
      .crewFromLegacy({
        photographer: 'Ann Taylor',
        calls: [
          { roles: ['Photographer'], time: '08:00' },
          { roles: ['Photographer'], time: '14:00' },
        ],
      })
      .map(crew.crewLine),
    ['08:00 Photographer · Ann Taylor', '14:00 Photographer'],
    'a second call in the same role is a second row',
  )
  eq(crew.crewFromLegacy({}), [], 'no roster and no calls: an empty sheet')
}
{
  // The estimate lists the crew by name, with when they are called.
  const sheetJob = estimate.buildEstimate(job, {
    inventory,
    booking: {
      id: 's1',
      unitIds: [],
      crew: [
        { role: 'Photographer', name: 'Marcus Reed', time: '08:00' },
        { role: 'Producer', time: '07:30' },
      ],
    },
  })
  eq(sheetJob.roster, [{ role: 'Photographer', name: 'Marcus Reed', time: '08:00' }], 'only NAMED rows go on a client document')
  const t = bytes(estimatePdf.buildEstimatePdf(sheetJob))
  ok(t.includes('(Marcus Reed) Tj') && t.includes('(08:00) Tj'), 'the estimate prints the person and their call')
  eq(
    estimate.buildEstimate(job, { inventory }).roster,
    [{ role: 'Photographer', name: 'Ann Taylor', time: null }],
    'a job with no shoot falls back to its own photographer',
  )
  eq(activity.jobFieldWords(['crew']), ['call times'], 'the feed calls an edited sheet "call times"')
}

console.log(`OK — ${n} assertions passed`)
