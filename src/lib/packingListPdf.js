// Packing list PDF (epic #6).
//
// Printable at every status but Canceled. The SAME four columns as the digital
// packing list — Equipment Item · Vendor Source · Check-Out · Check-In — so the
// crew holds one document in two forms: a check recorded in the app prints
// with its name and time; an empty cell is there to be filled in by hand. A
// rental house's line is highlighted in both.
//
// It reuses buildEstimate's grouped line model (same source of truth: the
// order's lines) and the estimate PDF's jsPDF setup + ASCII-safety, so the two
// documents stay visually of a piece and both run headless under Node.
import { jsPDF } from 'jspdf'
import { buildEstimate } from './estimate.js'
import { pdfSafe, drawStatusPill } from './estimatePdf.js'
import { showsSetName } from './orderSearch.js'
import {
  CHECK_IN,
  CHECK_OUT,
  isRentalHouse,
  itemLabel,
  packingProgress,
  packingRows,
  signerName,
  signoffOf,
  whenLabel,
} from './packing.js'
import { placeLabel } from '../data/studios.js'
import { BRAND_NAME } from './brand.js'

const PAGE = { w: 595.28, h: 841.89 } // A4 portrait, points
const M = 48
const INK = {
  text: [15, 23, 42],
  muted: [100, 116, 139],
  rule: [203, 213, 225],
  box: [148, 163, 184],
  accent: [124, 58, 237],
  // The rental-house highlight: Tailwind amber-100 / amber-800 — the same pair
  // the digital list paints, so the yellow on paper is the yellow on screen.
  rentalFill: [254, 243, 199],
  rentalInk: [146, 64, 14],
  rentalRing: [252, 211, 77],
  // A recorded check: violet-50 for out, emerald-50 for in, as on screen.
  outFill: [245, 243, 255],
  outInk: [76, 29, 149],
  inFill: [236, 253, 245],
  inInk: [6, 78, 59],
}

// The four columns, left edges; the last ends at the right margin.
const X = { item: M, source: M + 214, out: M + 292, in: M + 396, end: PAGE.w - M }
const PAD = 4

const slug = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export function packingListFileName(order) {
  const job = slug(order.jobName || order.setTitle || 'job') || 'job'
  const po = order.poNumber ? `-${order.poNumber}` : ''
  return `packing-list-${job}${po}.pdf`.replace(/--+/g, '-')
}

// `opts.docTitle` overrides the header (default "PACKING LIST").
export function buildPackingListPdf(orderOrEstimate, context, opts = {}) {
  const est = orderOrEstimate?.groups ? orderOrEstimate : buildEstimate(orderOrEstimate, context)
  // The printed sheet and the digital list must be the SAME list, or the crew
  // is ticking two different documents: one row per barcoded copy, counted rows
  // for everything that has no barcode of ours. `packingRows` is the one
  // definition (lib/packing.js), and `packing` the recorded checks.
  const rows = packingRows(est, { inventory: context?.inventory ?? [], booking: context?.booking ?? null })
  const packing = context?.packing ?? orderOrEstimate?.packing ?? {}
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = M

  const setInk = (c) => doc.setTextColor(c[0], c[1], c[2])
  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2])
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2])
  const text = (s, x, yy, o) => doc.text(pdfSafe(s), x, yy, o)
  const right = (s, x, yy) => doc.text(pdfSafe(s), x, yy, { align: 'right' })
  const rule = (yy) => {
    setDraw(INK.rule)
    doc.setLineWidth(0.5)
    doc.line(M, yy, PAGE.w - M, yy)
  }
  // One line that fits a width, cut with an ellipsis when it would not.
  const fit = (s, width) => {
    const lines = doc.splitTextToSize(pdfSafe(s), width)
    if (lines.length <= 1) return lines[0] ?? ''
    let first = lines[0]
    while (first.length > 1 && doc.getTextWidth(`${first}...`) > width) first = first.slice(0, -1)
    return `${first}...`
  }

  function tableHead(yy) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    setInk(INK.muted)
    text('EQUIPMENT ITEM', X.item, yy)
    text('VENDOR SOURCE', X.source, yy)
    text('CHECK-OUT', X.out, yy)
    text('CHECK-IN', X.in, yy)
    rule(yy + 6)
    return yy + 14
  }

  // Break to a new page when the next block wouldn't fit, repeating the head.
  const ensure = (needed, repeatHead) => {
    if (y + needed <= PAGE.h - M - 24) return
    doc.addPage()
    y = M
    if (repeatHead) y = tableHead(y)
  }

  // ---- header ------------------------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  setInk(INK.text)
  text(BRAND_NAME, M, y + 4)
  doc.setFontSize(9)
  setInk(INK.accent)
  right(opts.docTitle || 'PACKING LIST', PAGE.w - M, y - 4)
  // The job's REAL status: the sheet prints at every status but Canceled.
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
    // The crew pulling gear needs to know WHICH set of the day it's for — on a
    // PDP day. An editorial job has no sets, and prints no empty row for one.
    ...(showsSetName(est.order) ? [['Set name', est.order.setLabel || '—']] : []),
    ['Brand', est.order.brand || '—'],
    ['Shoot type', est.order.jobType || '—'],
    [
      // A shoot may run for several days, and the sheet has to say so: the crew
      // reads this to know when the gear goes out and when it is due back.
      est.days > 1 ? 'Shoot dates' : 'Shoot date',
      est.order.startsOn
        ? est.order.endsOn && est.order.endsOn !== est.order.startsOn
          ? `${est.order.startsOn} to ${est.order.endsOn}  (${est.days} days)`
          : est.order.startsOn
        : '—',
    ],
    // Several people may be on a job; the row wraps like an address does.
    [est.order.assignees?.length > 1 ? 'Assignees' : 'Assignee', est.order.assignees?.join(', ') || '—'],
    ['Client', est.order.companyName || '—'],
  ]
  doc.setFontSize(9)
  for (const [k, v] of meta) {
    // A value may be long — a location's full address — so it wraps inside the
    // page instead of running off the right edge. Measured in the value's own
    // (bold) face, because the width depends on the font.
    doc.setFont('helvetica', 'bold')
    const lines = doc.splitTextToSize(pdfSafe(String(v)), PAGE.w - M - (M + 100))
    ensure(15 + (lines.length - 1) * 11)
    doc.setFont('helvetica', 'normal')
    setInk(INK.muted)
    text(k, M, y)
    doc.setFont('helvetica', 'bold')
    setInk(INK.text)
    lines.forEach((line, i) => text(line, M + 100, y + i * 11))
    y += 15 + (lines.length - 1) * 11
  }
  y += 6

  // What the two check columns are, once, up top: a recorded check prints its
  // name and time; an empty cell is written in by hand.
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  setInk(INK.muted)
  text('Check-out: name and time when the piece is placed in the studio. Check-in: when it is back (tap or scan).', M, y)
  y += 11
  text('A recorded check prints below; an empty cell is to be filled in by hand.', M, y)
  y += 16

  // ---- equipment table ---------------------------------------------------
  y = tableHead(y)

  if (rows.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    setInk(INK.muted)
    text('No equipment on this job.', X.item, y + 8)
    y += 18
  }

  // A check cell: the recorded name + time in a tinted box, or an empty box.
  function checkCell(x0, x1, yTop, h, signoff, tone) {
    const w = x1 - x0 - 6
    if (signoff) {
      setFill(tone === 'in' ? INK.inFill : INK.outFill)
      setDraw(tone === 'in' ? INK.inInk : INK.outInk)
      doc.setLineWidth(0.5)
      doc.roundedRect(x0 + 3, yTop + 3, w, h - 6, 2, 2, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      setInk(tone === 'in' ? INK.inInk : INK.outInk)
      text(fit(signerName(signoff), w - 8), x0 + 7, yTop + 13)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      const when = `${whenLabel(signoff.at)}${signoff.via === 'scan' ? ' (scan)' : ''}`
      text(fit(when, w - 8), x0 + 7, yTop + 22)
    } else {
      setDraw(INK.box)
      doc.setLineWidth(0.5)
      doc.rect(x0 + 3, yTop + 3, w, h - 6)
    }
  }

  for (const g of rows) {
    ensure(34, true)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setInk(INK.accent)
    text(g.type === 'kit' ? `KIT — ${g.name}` : 'A-LA-CARTE', X.item, y + 8)
    setInk(INK.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    right(`${g.lines.reduce((n, l) => n + (Number(l.quantity) || 1), 0)} pcs`, X.end, y + 8)
    y += 16

    for (const l of g.lines) {
      // 1 · the item — its note in parentheses right after the name, up to two
      // lines; the detail (barcode, slot, quantity) on a line of its own.
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const nameLines = doc.splitTextToSize(pdfSafe(itemLabel(l)), X.source - X.item - 2 * PAD)
      const shown = nameLines.slice(0, 2)
      if (nameLines.length > 2) shown[1] = fit(`${shown[1]} ${nameLines.slice(2).join(' ')}`, X.source - X.item - 2 * PAD)
      const detail = [
        l.slotLabel,
        l.barcode ? `#${l.barcode}` : null,
        l.kind === 'bulk' ? `x${l.quantity}` : null,
        l.kind === 'bulk' && l.why ? l.why : null,
      ]
        .filter(Boolean)
        .join(' · ')
      const rowH = Math.max(28, PAD + shown.length * 11 + (detail ? 10 : 0) + PAD)
      ensure(rowH, true)

      setInk(INK.text)
      shown.forEach((line, i) => text(line, X.item, y + PAD + 8 + i * 11))
      if (detail) {
        doc.setFontSize(7.5)
        setInk(INK.muted)
        text(fit(detail, X.source - X.item - 2 * PAD), X.item, y + PAD + 8 + shown.length * 11 - 1)
      }

      // 2 · vendor source — a rental house is filled yellow, as on screen.
      const rental = isRentalHouse(l)
      const sw = X.out - X.source - 6
      if (rental) {
        setFill(INK.rentalFill)
        setDraw(INK.rentalRing)
        doc.setLineWidth(0.5)
        doc.roundedRect(X.source + 3, y + 3, sw, rowH - 6, 2, 2, 'FD')
      }
      doc.setFont('helvetica', rental ? 'bold' : 'normal')
      doc.setFontSize(7.5)
      setInk(rental ? INK.rentalInk : INK.text)
      text(rental ? 'Rental House' : 'In-House', X.source + 7, y + 13)
      if (rental && l.vendorName) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        text(fit(l.vendorName, sw - 8), X.source + 7, y + 22)
      }

      // 3 · out, 4 · in
      checkCell(X.out, X.in, y, rowH, signoffOf(packing, l, CHECK_OUT), 'out')
      checkCell(X.in, X.end, y, rowH, signoffOf(packing, l, CHECK_IN), 'in')

      y += rowH
      setDraw(INK.rule)
      doc.setLineWidth(0.3)
      doc.line(M, y, PAGE.w - M, y)
    }
    y += 6
  }

  // ---- totals line -------------------------------------------------------
  ensure(30)
  rule(y)
  y += 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(INK.text)
  const allLines = rows.flatMap((g) => g.lines)
  const prog = packingProgress(allLines, packing)
  text(`${prog.total} rows · ${est.pieces} pieces · ${prog.out} checked out · ${prog.back} checked in`, M, y)

  // ---- footer on every page ---------------------------------------------
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    setInk(INK.muted)
    text('Packing list — check out when it goes to the studio, check in when it is back.', M, PAGE.h - M + 12)
    right(`Page ${p} of ${pages}`, PAGE.w - M, PAGE.h - M + 12)
  }

  return doc
}

export function downloadPackingListPdf(order, context, opts = {}) {
  const est = order?.groups ? order : buildEstimate(order, context)
  const doc = buildPackingListPdf(est, { ...(context ?? {}), packing: context?.packing ?? order?.packing ?? {} }, opts)
  doc.save(packingListFileName(est.order))
}
