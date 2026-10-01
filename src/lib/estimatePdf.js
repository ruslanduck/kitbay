// Estimate PDF (epic #5, 5.4).
//
// `buildEstimatePdf` returns a jsPDF document and touches no browser API, so the
// exact same code path that produces the customer's file can be run in Node and
// inspected. `downloadEstimatePdf` is the thin browser wrapper.
//
// The table is hand-laid rather than pulled from a plugin: the layout is simple,
// and this keeps pagination, column widths and the repeated header under our own
// control (and one dependency lighter).
import { jsPDF } from 'jspdf'
// Explicit .js extensions: Vite resolves them fine and it keeps this module
// (and estimate.js) runnable under plain Node, which is how the PDF is tested.
import { buildEstimate, money } from './estimate.js'
import { placeLabel } from '../data/studios.js'
import { orderStatusMeta } from '../data/orderStatus.js'
import { showsSetName } from './orderSearch.js'
import { BRAND_NAME } from './brand.js'
import { assigneeLabel } from './peopleOptions.js'

const PAGE = { w: 595.28, h: 841.89 } // A4 portrait, points
const M = 48 // page margin
const COL = {
  item: M,
  detail: M + 210,
  qty: M + 330,
  rate: M + 390,
  total: PAGE.w - M,
}
const INK = { text: [15, 23, 42], muted: [100, 116, 139], rule: [203, 213, 225], accent: [124, 58, 237] }

// jsPDF's built-in Helvetica is WinAnsi-encoded. A character outside it (an arrow,
// an em dash) either vanishes or — worse — flips the whole string into a 16-bit
// encoding that renders as s p a c e d   o u t   l e t t e r s. Every string the
// PDF writes goes through here, so the typography we use on screen degrades to
// safe ASCII on paper instead of corrupting the line. (The middle dot IS in
// WinAnsi, so it is deliberately left alone.)
const ASCII = [
  [/[→⇒]/g, '->'],
  [/[—–−]/g, '-'],
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
  [/…/g, '...'],
  [/≤/g, '<='],
  [/≥/g, '>='],
  [/ /g, ' '],
]
export function pdfSafe(value) {
  let out = String(value ?? '')
  for (const [re, to] of ASCII) out = out.replace(re, to)
  return out
}

// The job's status the way every screen draws it: a pill in the status's OWN
// colours — fill, ring, dot and text, Confirmed green, Hold amber, Closed grey,
// Canceled red — from orderStatus.js, the definition the app's pills read.
// Before this the estimate printed a word of its own in grey (FULFILLED, for
// what the app calls Closed) and the packing list said CONFIRMED whatever the
// job was. `right` is where the pill ends; `top` is its top edge.
export function drawStatusPill(doc, status, right, top) {
  const meta = orderStatusMeta(status)
  const { fill, ink, ring, dot } = meta.print
  const label = pdfSafe(meta.label)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const h = 14
  const padX = 7
  const r = 2.2
  const gap = 4
  const w = padX + r * 2 + gap + doc.getTextWidth(label) + padX
  const x = right - w
  doc.setLineWidth(0.6)
  doc.setFillColor(fill[0], fill[1], fill[2])
  doc.setDrawColor(ring[0], ring[1], ring[2])
  doc.roundedRect(x, top, w, h, h / 2, h / 2, 'FD')
  // The dot is DRAWN, not typed: "●" is outside Helvetica's WinAnsi set.
  doc.setFillColor(dot[0], dot[1], dot[2])
  doc.circle(x + padX + r, top + h / 2, r, 'F')
  doc.setTextColor(ink[0], ink[1], ink[2])
  doc.text(label, x + padX + r * 2 + gap, top + h / 2 + 2.9)
}

export function estimateFileName(estimate) {
  const job = (estimate.order.jobName || 'estimate')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const po = estimate.order.poNumber ? `-${estimate.order.poNumber}` : ''
  return `estimate-${job || 'job'}${po}.pdf`.replace(/--+/g, '-')
}

export function buildEstimatePdf(estimateOrOrder, context) {
  // Accept either a prebuilt estimate or (order, context) for convenience.
  const est = estimateOrOrder?.groups ? estimateOrOrder : buildEstimate(estimateOrOrder, context)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = M

  const setInk = (c) => doc.setTextColor(c[0], c[1], c[2])
  const text = (s, x, yy, opts) => doc.text(pdfSafe(s), x, yy, opts)
  const right = (s, x, yy) => doc.text(pdfSafe(s), x, yy, { align: 'right' })

  const rule = (yy) => {
    doc.setDrawColor(INK.rule[0], INK.rule[1], INK.rule[2])
    doc.setLineWidth(0.5)
    doc.line(M, yy, PAGE.w - M, yy)
  }

  // Break to a new page when the next block wouldn't fit, repeating the table head.
  const ensure = (needed, repeatHead) => {
    if (y + needed <= PAGE.h - M - 24) return
    doc.addPage()
    y = M
    if (repeatHead) y = tableHead(y)
  }

  function tableHead(yy) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    setInk(INK.muted)
    text('EQUIPMENT', COL.item, yy)
    text('DETAIL', COL.detail, yy)
    right('QTY', COL.qty + 20, yy)
    right('DAY RATE', COL.rate + 50, yy)
    right('LINE TOTAL', COL.total, yy)
    rule(yy + 6)
    return yy + 20
  }

  // ---- header ------------------------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  setInk(INK.text)
  text(BRAND_NAME, M, y + 4)

  doc.setFontSize(9)
  setInk(INK.accent)
  right('EQUIPMENT ESTIMATE', PAGE.w - M, y - 4)
  drawStatusPill(doc, est.order.status, PAGE.w - M, y + 1)
  y += 22
  rule(y)
  y += 22

  // ---- job block ---------------------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  setInk(INK.text)
  text(est.order.jobName, M, y)
  y += 20

  const meta = [
    ['PO number', est.order.poNumber || '—'],
    ['Job ref', est.order.number || '—'],
    // A location shoot carries its address, so the crew reading the sheet knows
    // which building to drive to.
    ['Location / Studio', placeLabel(est.order.studioId, est.order.location) ?? '—'],
    // Only a PDP day has sets; an editorial job prints no empty row for one.
    ...(showsSetName(est.order) ? [['Set name', est.order.setLabel || '—']] : []),
    ['Brand', est.order.brand || '—'],
    ['Shoot type', est.order.jobType || '—'],
    [
      // A shoot may run for several days (20260909120000), and the sheet has to
      // say so: the crew reads this to know when the gear goes out and when it
      // is due back.
      est.days > 1 ? 'Shoot dates' : 'Shoot date',
      est.order.startsOn
        ? est.order.endsOn && est.order.endsOn !== est.order.startsOn
          ? `${est.order.startsOn} to ${est.order.endsOn}  (${est.days} days)`
          : est.order.startsOn
        : '—',
    ],
    // Several people may be on a job; the row wraps like an address does.
    [
      est.order.assignees?.length > 1 ? 'Assignees' : 'Assignee',
      (est.order.assignees ?? []).map(assigneeLabel).join(', ') || '—',
    ],
    ['Client', est.order.companyName || '—'],
    [
      'Raised by',
      [est.order.createdBy, est.order.createdAt ? String(est.order.createdAt).slice(0, 10) : null]
        .filter(Boolean)
        .join(' · ') || '—',
    ],
  ]
  doc.setFontSize(9)
  for (const [k, v] of meta) {
    // A value may be long now — a location's full address — so it wraps inside
    // the page instead of running off the right edge. Measured in the value's
    // own (bold) face, because the width depends on the font.
    doc.setFont('helvetica', 'bold')
    const lines = doc.splitTextToSize(pdfSafe(String(v)), PAGE.w - M - (M + 100))
    ensure(16 + (lines.length - 1) * 11)
    doc.setFont('helvetica', 'normal')
    setInk(INK.muted)
    text(k, M, y)
    doc.setFont('helvetica', 'bold')
    setInk(INK.text)
    lines.forEach((line, i) => text(line, M + 100, y + i * 11))
    y += 15 + (lines.length - 1) * 11
  }
  y += 8

  // ---- crew --------------------------------------------------------------
  ensure(40)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  setInk(INK.muted)
  text('CREW', M, y)
  y += 14
  doc.setFontSize(9)
  if (est.roster.length === 0) {
    doc.setFont('helvetica', 'italic')
    setInk(INK.muted)
    text('No crew assigned yet.', M, y)
    y += 16
  } else {
    for (const r of est.roster) {
      ensure(15)
      doc.setFont('helvetica', 'normal')
      setInk(INK.muted)
      text(r.role, M, y)
      doc.setFont('helvetica', 'bold')
      setInk(INK.text)
      text(r.name, M + 100, y)
      // When they're called — the call sheet's reason to exist.
      if (r.time) {
        doc.setFont('helvetica', 'normal')
        setInk(INK.muted)
        text(r.time, M + 300, y)
      }
      y += 15
    }
  }
  y += 12

  // ---- equipment table ---------------------------------------------------
  y = tableHead(y)

  if (est.groups.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    setInk(INK.muted)
    text('No equipment assigned to this job yet.', COL.item, y)
    y += 18
  }

  for (const g of est.groups) {
    ensure(34, true)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setInk(INK.accent)
    text(g.type === 'kit' ? `KIT — ${g.name}` : 'A-LA-CARTE', COL.item, y)
    setInk(INK.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    right(`${g.pieces} pcs · ${money(g.subtotal)}`, COL.total, y)
    y += 15

    for (const l of g.lines) {
      ensure(15, true)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      setInk(INK.text)
      // Long names are clipped so columns never collide.
      text(doc.splitTextToSize(pdfSafe(l.itemName), COL.detail - COL.item - 10)[0], COL.item, y)

      setInk(INK.muted)
      doc.setFontSize(8)
      const detail = [l.slotLabel, l.barcode ? `#${l.barcode}` : null].filter(Boolean).join(' · ')
      text(detail || '—', COL.detail, y)

      setInk(INK.text)
      doc.setFontSize(9)
      right(l.quantity, COL.qty + 20, y)
      right(l.dayRate == null ? 'n/a' : money(l.dayRate), COL.rate + 50, y)
      right(l.dayRate == null ? '—' : money(l.lineTotal), COL.total, y)
      y += 14
    }
    y += 6
  }

  // ---- totals ------------------------------------------------------------
  ensure(70)
  rule(y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setInk(INK.muted)
  text(`${est.lineCount} lines · ${est.pieces} pieces · ${est.days} billable day(s)`, M, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  setInk(INK.text)
  right(`Equipment total: ${money(est.total)}`, COL.total, y + 2)
  y += 24

  if (est.unratedCount > 0) {
    ensure(30)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    setInk(INK.muted)
    const names = est.unratedNames.slice(0, 4).join(', ')
    const more = est.unratedCount > 4 ? `, +${est.unratedCount - 4} more` : ''
    text(
      `${est.unratedCount} line(s) have no day rate and are excluded from the total: ${names}${more}.`,
      M,
      y,
    )
    y += 14
  }

  // ---- footer on every page ---------------------------------------------
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    setInk(INK.muted)
    text('Estimate — equipment cost only. Not an invoice.', M, PAGE.h - M + 12)
    right(`Page ${p} of ${pages}`, PAGE.w - M, PAGE.h - M + 12)
  }

  return doc
}

export function downloadEstimatePdf(order, context) {
  const est = order?.groups ? order : buildEstimate(order, context)
  const doc = buildEstimatePdf(est)
  doc.save(estimateFileName(est))
}
