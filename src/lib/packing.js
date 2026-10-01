// Packing list rules (epic #6). Shared by the store, the digital checklist, the
// job card and the printed sheet, so they all agree on what a row is, how it is
// identified, and what "checked out" and "checked in" mean.
//
// THE LIFECYCLE: every row is checked OUT when the piece is placed in the
// studio and checked IN when it comes back — each recording WHO (the signed-in
// account's name) and WHEN, automatically. Check-in can also be done by scanning
// the piece's barcode (or a QR code carrying it).
//
// Storage: the two moments live in `packing_signoffs`' existing slots — `out1`
// (which used to be the single "packed" tick, so an order ticked before this
// change reads as checked out) and `ret`, which the table carried from the
// start and nothing wrote until now. The 20261001120000 migration adds the NAME
// beside each slot's initials, and how the return was recorded.
export const CHECK_OUT = 'out1'
export const CHECK_IN = 'ret'
export const PACKING_SLOTS = [CHECK_OUT, CHECK_IN]
// Kept for callers that still say "packed": packed IS checked out.
export const PACKED_SLOT = CHECK_OUT

// How a check-in was recorded.
export const VIA_MANUAL = 'manual'
export const VIA_SCAN = 'scan'

// A stable key for a packing-list line. Order lines are replaced wholesale when
// equipment is edited, so sign-offs are keyed by the line's CONTENT, not its id:
// item + slot label + barcode, which is unique now that barcoded stock is one row
// per copy (see `packingRows`).
export const packingLineKey = (line) =>
  `${line.itemId ?? ''}::${line.slotLabel ?? ''}::${line.barcode ?? ''}`

// The Vendor Source column's words — the ticket's, not the editor's. A line is
// in-house (our own gear) or comes from a rental house; the rental house is
// highlighted on screen and on paper because it is the gear that has to go BACK
// somewhere else.
export const SOURCE_LABEL = { in_house: 'In-House', sub_rental: 'Rental House' }
export const isRentalHouse = (row) => row?.source === 'sub_rental'
export function sourceLabel(row) {
  const base = SOURCE_LABEL[row?.source] ?? SOURCE_LABEL.in_house
  return isRentalHouse(row) && row.vendorName ? `${base} · ${row.vendorName}` : base
}

// "Profoto B10 (Needs new battery)" — the note sits in parentheses right after
// the name, on screen and on paper. No separate column.
export function itemLabel(row) {
  const note = String(row?.note ?? '').trim()
  return note ? `${row.itemName} (${note})` : String(row?.itemName ?? '')
}

// What the crew actually ticks off, one row at a time.
//
// An order LINE is not a row: an a-la-carte line says "Arri 2K Open Face x2",
// and two physical bodies get pulled, carried and returned separately — ticking
// one box for both is how a piece goes missing. So barcoded stock is expanded to
// ONE ROW PER COPY, with the barcode that will be on the case.
//
// What can't be expanded stays a counted row, and says why:
//   • non-barcoded stock is counted, not tracked copy by copy;
//   • a RENTAL-HOUSE line is the vendor's gear — it has no barcode of ours;
//   • pieces the order asks for beyond what is reserved have no unit to name
//     (over-capacity, deliberately allowed) — they stay as a remainder row
//     rather than silently disappearing off the packing list.
//
// The concrete copies come from the SET's reservations (`booking.unitIds`), the
// same source the reservations give — a loose line carries a quantity, and
// the reservation is the resolved answer to "which ones".
export function packingRows(estimate, { inventory = [], booking = null } = {}) {
  const groups = estimate?.groups ?? []
  const itemsById = Object.fromEntries(inventory.map((i) => [i.id, i]))
  const reserved = new Set(booking?.unitIds ?? [])

  // Units already named by a kit slot are spoken for and must not be handed to a
  // loose line of the same item as well.
  const taken = new Set()
  for (const g of groups) for (const l of g.lines) if (l.unitId) taken.add(l.unitId)

  const unitOf = (unitId, itemId) =>
    (itemsById[itemId]?.units ?? []).find((u) => u.id === unitId) ?? null

  const out = []
  for (const g of groups) {
    const rows = []
    for (const l of g.lines) {
      const item = itemsById[l.itemId] ?? null
      const base = {
        itemId: l.itemId,
        itemName: l.itemName,
        // The line's note travels onto every row the line expands to.
        note: String(l.notes ?? l.note ?? '').trim() || null,
        slotLabel: l.slotLabel ?? null,
        kitId: l.kitId ?? null,
        source: l.source ?? 'in_house',
        vendorName: l.vendorName ?? null,
        dayRate: l.dayRate ?? null,
      }

      // A kit slot already names its copy.
      if (l.unitId) {
        const u = unitOf(l.unitId, l.itemId)
        rows.push({ ...base, kind: 'unit', unitId: l.unitId, barcode: l.barcode ?? u?.barcode ?? null, serial: u?.serial ?? null, quantity: 1 })
        continue
      }

      const qty = Math.max(1, Number(l.quantity) || 1)
      const barcoded = item?.kind === 'barcoded'
      if (!barcoded || base.source === 'sub_rental') {
        rows.push({
          ...base,
          kind: 'bulk',
          unitId: null,
          barcode: null,
          quantity: qty,
          why: base.source === 'sub_rental' ? 'vendor gear' : 'counted stock',
        })
        continue
      }

      // Expand to the reserved copies of this item that nothing else holds.
      const mine = (item.units ?? []).filter((u) => reserved.has(u.id) && !taken.has(u.id)).slice(0, qty)
      for (const u of mine) {
        taken.add(u.id)
        rows.push({ ...base, kind: 'unit', unitId: u.id, barcode: u.barcode ?? null, serial: u.serial ?? null, quantity: 1 })
      }
      const short = qty - mine.length
      if (short > 0)
        rows.push({
          ...base,
          kind: 'bulk',
          unitId: null,
          barcode: null,
          quantity: short,
          why: 'no unit reserved',
        })
    }
    if (rows.length) out.push({ ...g, lines: rows })
  }
  return out
}

// The recorded sign-off of one slot on one row, or null. A legacy double
// sign-out from the three-field era still counts as checked out, so an order
// packed before this change still reads right.
export function signoffOf(packing, line, slot) {
  const s = (packing || {})[packingLineKey(line)] || {}
  if (slot === CHECK_OUT && !s.out1?.initials && s.out2?.initials) return s.out2
  const v = s[slot]
  return v?.initials || v?.name ? v : null
}

// How many rows are checked out, and how many of those are back.
export function packingProgress(lines = [], packing = {}) {
  let out = 0
  let back = 0
  for (const l of lines) {
    if (signoffOf(packing, l, CHECK_OUT)) out += 1
    if (signoffOf(packing, l, CHECK_IN)) back += 1
  }
  return { total: lines.length, out, back }
}

// The person as the sheet prints them: the recorded name, or the initials the
// three-field era stored when there was no name yet.
export const signerName = (signoff) => signoff?.name || signoff?.initials || ''

// The moment as the sheet prints it: "01 Oct 2026, 14:32". One fixed, English
// format (the UI is English-only) so the screen and the PDF agree to the minute.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function whenLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const two = (n) => String(n).padStart(2, '0')
  return `${two(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${two(d.getHours())}:${two(d.getMinutes())}`
}

// Where a scanned code lands: the row carrying that barcode (bare digits — the
// decorative # is stripped by the caller through lib/barcode), and what doing
// `slot` to it would mean. Every outcome is a sentence the station can show.
export function resolvePackingScan(rows, packing, code, slot = CHECK_IN) {
  const needle = String(code ?? '').trim()
  if (!needle) return { ok: false, reason: 'Scan or type a barcode.' }
  const row = rows.find((r) => r.kind === 'unit' && String(r.barcode ?? '') === needle)
  if (!row) return { ok: false, reason: `#${needle} isn't on this job's packing list.` }
  const name = itemLabel(row)
  const already = signoffOf(packing, row, slot)
  if (already)
    return {
      ok: false,
      row,
      reason: `#${needle} ${name} is already checked ${slot === CHECK_IN ? 'in' : 'out'} (${signerName(already)}).`,
    }
  // Checking in a piece that was never checked out is allowed — a crew can pull
  // a job without the sheet and still record the return — but said out loud.
  const note = slot === CHECK_IN && !signoffOf(packing, row, CHECK_OUT) ? ' (it was never checked out)' : ''
  return { ok: true, row, message: `#${needle} ${name} — checked ${slot === CHECK_IN ? 'in' : 'out'}${note}.` }
}
