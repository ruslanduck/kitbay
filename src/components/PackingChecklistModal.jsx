import { useEffect, useRef, useState } from 'react'
import { Barcode, Check, Layers, LogIn, LogOut, PackageCheck, ScanLine } from 'lucide-react'
import Modal from './Modal'
import { useStore } from '../store'
import { normalizeBarcode } from '../lib/barcode'
import {
  CHECK_IN,
  CHECK_OUT,
  VIA_SCAN,
  isRentalHouse,
  itemLabel,
  packingLineKey,
  packingProgress,
  packingRows,
  resolvePackingScan,
  signerName,
  signoffOf,
  sourceLabel,
  whenLabel,
} from '../lib/packing'

// Two letters for the person doing the packing — the data still carries them
// beside the full name, so a sheet signed in the initials era reads the same.
const initialsOf = (name) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'

// The digital packing list: the same four columns as the printed one —
// Equipment Item · Vendor Source · Check-Out · Check-In — so the crew is reading
// one document whichever form it holds. Each check records the signed-in
// account's name and the time by itself; a check-in can also be a SCAN of the
// piece's barcode (or a QR code carrying it). A rental house's line is
// highlighted, because that gear has to go back somewhere else.
//
// Sign-offs are optimistic and auto-saved through the store.
export default function PackingChecklistModal({
  open,
  order,
  estimate,
  title = 'Packing list',
  onSign,
  onClear,
  onClose,
}) {
  // The shoot supplies the concrete copies (its reservations), which is what lets
  // a x2 line become two rows. Read here rather than threaded through every
  // caller — the same reasoning as ItemAvailability.
  const inventory = useStore((s) => s.inventory)
  const bookings = useStore((s) => s.bookings)
  const profile = useStore((s) => s.profile)
  const myName = profile?.full_name || 'Demo user'
  const myInitials = initialsOf(myName)

  const packing = order?.packing || {}
  const booking = bookings.find((b) => b.id === order?.setId) ?? null
  const groups = packingRows(estimate, { inventory, booking })
  const allLines = groups.flatMap((g) => g.lines)
  const prog = packingProgress(allLines, packing)

  const sign = (line, slot, via) =>
    onSign(packingLineKey(line), slot, myInitials, itemLabel(line), { name: myName, via })
  const clear = (line, slot) => onClear(packingLineKey(line), slot)

  // ── the scanner: one field, pointed at check-in (the ticket's case) or out.
  const [scanDir, setScanDir] = useState(CHECK_IN)
  const [scan, setScan] = useState('')
  const [scanMsg, setScanMsg] = useState(null) // { ok, text }
  const scanRef = useRef(null)
  useEffect(() => {
    if (!open) return
    setScan('')
    setScanMsg(null)
    setScanDir(CHECK_IN)
  }, [open])
  const knownCodes = new Set(allLines.filter((r) => r.kind === 'unit' && r.barcode).map((r) => String(r.barcode)))

  function takeScan(raw) {
    const code = normalizeBarcode(raw)
    const v = resolvePackingScan(allLines, packing, code, scanDir)
    if (v.ok) {
      sign(v.row, scanDir, scanDir === CHECK_IN ? VIA_SCAN : undefined)
      setScanMsg({ ok: true, text: v.message })
    } else setScanMsg({ ok: false, text: v.reason })
    setScan('')
    scanRef.current?.focus()
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" title={title}>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {order && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-900">
                {order.jobName ?? order.setTitle ?? 'Job'}
              </div>
              {order.poNumber && (
                <div className="mt-0.5 text-xs text-slate-500">PO {order.poNumber}</div>
              )}
            </div>
            <div className="flex shrink-0 gap-4 text-center text-xs">
              <div>
                <div className="text-base font-semibold text-violet-700">
                  {prog.out}/{prog.total}
                </div>
                <div className="text-slate-400">checked out</div>
              </div>
              <div>
                <div className="text-base font-semibold text-emerald-700">
                  {prog.back}/{prog.total}
                </div>
                <div className="text-slate-400">checked in</div>
              </div>
            </div>
          </div>
        )}

        {allLines.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            No equipment on this job to pack.
          </p>
        ) : (
          <>
            {/* Scan to check in (or out). A reader ends with Enter; a code
                pasted off the screen doesn't, so a value that IS a barcode on
                this list fires on its own. The decorative # is stripped. */}
            <div className="mb-3 rounded-lg border border-slate-200 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border border-slate-200 p-0.5 text-[11px] font-medium">
                  {[
                    [CHECK_IN, 'Check in'],
                    [CHECK_OUT, 'Check out'],
                  ].map(([slot, label]) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setScanDir(slot)
                        scanRef.current?.focus()
                      }}
                      className={[
                        'rounded px-2 py-1 transition',
                        scanDir === slot ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="relative min-w-0 flex-1">
                  <ScanLine size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={scanRef}
                    type="text"
                    value={scan}
                    onChange={(e) => {
                      const v = e.target.value
                      setScan(v)
                      if (knownCodes.has(normalizeBarcode(v))) takeScan(v)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        takeScan(scan)
                      }
                    }}
                    placeholder={`Scan a barcode or QR to ${scanDir === CHECK_IN ? 'check in' : 'check out'}…`}
                    aria-label="Scan a barcode or QR"
                    autoComplete="off"
                    className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-2 font-mono text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => takeScan(scan)}
                  disabled={!scan.trim()}
                  className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {scanDir === CHECK_IN ? 'Check in' : 'Check out'}
                </button>
              </div>
              {scanMsg && (
                <p
                  className={[
                    'mt-1.5 px-1 text-xs',
                    scanMsg.ok ? 'text-emerald-700' : 'text-rose-600',
                  ].join(' ')}
                >
                  {scanMsg.text}
                </p>
              )}
            </div>

            {/* The column heads — the printed sheet's, in the same order. */}
            <div className="mb-1 hidden grid-cols-[minmax(0,1fr)_10rem_8.5rem_8.5rem] gap-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:grid">
              <span>Equipment item</span>
              <span>Vendor source</span>
              <span>Check-out</span>
              <span>Check-in</span>
            </div>

            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.kitId ?? 'items'}>
                  <div className="mb-1 px-1">
                    <span
                      className={[
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        g.type === 'kit'
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-slate-200 text-slate-600',
                      ].join(' ')}
                    >
                      {g.type === 'kit' && <Layers size={10} />}
                      {g.type === 'kit' ? g.name : 'A-la-carte'}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {g.lines.map((l, i) => {
                      const key = packingLineKey(l)
                      const out = signoffOf(packing, l, CHECK_OUT)
                      const back = signoffOf(packing, l, CHECK_IN)
                      const rental = isRentalHouse(l)
                      return (
                        <li
                          key={`${key}-${i}`}
                          className={[
                            'grid grid-cols-1 items-center gap-2 rounded-lg border px-3 py-2 sm:grid-cols-[minmax(0,1fr)_10rem_8.5rem_8.5rem]',
                            back
                              ? 'border-emerald-200 bg-emerald-50/40'
                              : out
                                ? 'border-violet-200 bg-violet-50/30'
                                : 'border-slate-200',
                          ].join(' ')}
                        >
                          {/* 1 · the item, its note in parentheses right after */}
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-800">
                              {l.itemName}
                              {l.note && <span className="font-normal text-slate-500"> ({l.note})</span>}
                              {l.slotLabel && (
                                <span className="ml-1.5 text-[11px] uppercase tracking-wide text-slate-400">
                                  {l.slotLabel}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                              {l.kind === 'unit' ? (
                                <span className="inline-flex items-center gap-1 font-mono text-slate-500">
                                  <Barcode size={11} />#{l.barcode ?? '—'}
                                </span>
                              ) : (
                                <>
                                  <span className="font-medium text-slate-500">×{l.quantity}</span>
                                  <span className={l.why === 'no unit reserved' ? 'text-amber-600' : ''}>
                                    {l.why}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* On a phone the item takes a line, the source the next
                              and the two checks a third, side by side; from `sm`
                              the wrappers dissolve into the four-column grid. */}
                          <div className="flex flex-col gap-1.5 sm:contents">
                            {/* 2 · where it comes from — a rental house in yellow */}
                            <div className="min-w-0">
                              <span
                                className={[
                                  'inline-flex max-w-full items-center rounded-md px-2 py-1 text-[11px] font-medium',
                                  rental
                                    ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                                    : 'bg-slate-100 text-slate-600',
                                ].join(' ')}
                                title={sourceLabel(l)}
                              >
                                <span className="truncate">{sourceLabel(l)}</span>
                              </span>
                            </div>

                            {/* 3 · out, 4 · in */}
                            <div className="grid grid-cols-2 gap-2 sm:contents">
                              <SignCell
                                slot={CHECK_OUT}
                                signoff={out}
                                icon={LogOut}
                                label="Check out"
                                tone="violet"
                                onSign={() => sign(l, CHECK_OUT)}
                                onClear={() => clear(l, CHECK_OUT)}
                              />
                              <SignCell
                                slot={CHECK_IN}
                                signoff={back}
                                icon={LogIn}
                                label="Check in"
                                tone="emerald"
                                onSign={() => sign(l, CHECK_IN)}
                                onClear={() => clear(l, CHECK_IN)}
                              />
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <PackageCheck size={14} /> Signing as {myName}.
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}

// One check cell. Empty: a tap records the signed-in account's name and the
// time. Signed: it shows them — and because a name and a time are a record,
// undoing takes a second, deliberate tap ("Undo?") rather than the first.
function SignCell({ signoff, icon: Icon, label, tone, onSign, onClear }) {
  const [asking, setAsking] = useState(false)
  const signed = !!signoff
  const tint =
    tone === 'emerald'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : 'border-violet-300 bg-violet-50 text-violet-900'
  if (!signed)
    return (
      <button
        type="button"
        onClick={onSign}
        aria-label={label}
        className="inline-flex h-10 w-full sm:w-[8.5rem] items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 text-xs font-medium text-slate-500 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700"
      >
        <Icon size={13} />
        {label}
      </button>
    )
  if (asking)
    return (
      <div className="flex h-10 w-full sm:w-[8.5rem] items-center justify-center gap-1 rounded-md border border-rose-200 bg-rose-50 text-[11px]">
        <span className="font-medium text-rose-800">Undo?</span>
        <button
          type="button"
          onClick={() => {
            setAsking(false)
            onClear()
          }}
          className="rounded bg-danger px-1.5 py-0.5 font-semibold text-white transition hover:bg-danger-strong"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="rounded px-1.5 py-0.5 font-medium text-rose-700 transition hover:bg-surface"
        >
          No
        </button>
      </div>
    )
  return (
    <button
      type="button"
      onClick={() => setAsking(true)}
      title={`${label}: ${signerName(signoff)} · ${whenLabel(signoff.at)}${signoff.via === 'scan' ? ' · scanned' : ''} — tap to undo`}
      aria-label={`${label} by ${signerName(signoff)} at ${whenLabel(signoff.at)}`}
      className={`flex h-10 w-full sm:w-[8.5rem] flex-col justify-center rounded-md border px-2 text-left transition ${tint}`}
    >
      <span className="flex items-center gap-1 truncate text-[11px] font-semibold">
        <Check size={11} strokeWidth={3} className="shrink-0" />
        <span className="truncate">{signerName(signoff)}</span>
      </span>
      <span className="truncate text-[10px] opacity-80">
        {whenLabel(signoff.at)}
        {signoff.via === 'scan' ? ' · scan' : ''}
      </span>
    </button>
  )
}
