import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { isValidTime, minuteOptions, parseTimeInput, stepTime, toHHMM } from '../lib/callTimes'
import { formatTime } from '../lib/clock'

// The one time field in the app — a call time, the general call, and the wrap.
//
// Locale-proof by construction: a native <input type="time"> has its placeholder
// and its own picker drawn by the OPERATING SYSTEM (чч:мм on a Russian browser,
// unstyleable), which is the same trade DateField and SelectField already made.
// So the field is a text input and the list below is ours. It SHOWS the 12-hour
// clock the studio works in ("5PM", lib/clock) and hands its parent "HH:MM",
// 24-hour — the stored shape, which sorts as text.
//
// THREE ways to set a time, because a phone and a desk are not the same hand:
//   • the LIST — three flickable columns, the way a 12-hour time is picked
//     everywhere else: HOUR (12, 1 … 11), MINUTE, then AM/PM. Nothing is
//     written until the hour AND the half of the day are known — the field
//     never guesses AM or PM — and the minute is :00 unless one is picked. The
//     AM/PM tap is the last step, so it closes the list.
//   • TYPING — "5pm" · "5:30p" · "530pm" · "8" · "17:30" all snap on blur or
//     Enter (lib/callTimes `parseTimeInput`). Nobody has to reach for the colon,
//     and whoever types the 24-hour clock is still understood.
//   • ARROW KEYS — ±5 minutes, for correcting a value without retyping it.
const STEP = 5
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTES = minuteOptions(STEP)
const PERIODS = ['AM', 'PM']
// Where an empty field's hour column opens. A studio calls people in the
// morning, not at 12AM — opening at midnight would make every pick a scroll.
const OPEN_AT_HOUR = 8
const NOTHING = { h: null, m: null, p: null }

const pad = (n) => String(n).padStart(2, '0')
// "17" → { h: 5, p: 'PM' }; the stored minute stays as it is (it may be off the
// 5-minute grid, e.g. 08:07, and must survive an hour or AM/PM change).
const partsOf = (hhmm) => {
  const [hh, mm] = hhmm.split(':')
  const h24 = Number(hh)
  return { h: h24 % 12 || 12, m: mm, p: h24 < 12 ? 'AM' : 'PM' }
}
const compose = ({ h, m, p }) => `${pad((h % 12) + (p === 'PM' ? 12 : 0))}:${m ?? '00'}`

// Rows are deliberately tall: this list is used with a thumb.
const ROW = 'flex w-full items-center justify-center px-2 py-2.5 text-sm transition'

export default function TimeField({ value, onChange, className, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const popRef = useRef(null)
  const hourCol = useRef(null)
  const minCol = useRef(null)

  // The stored value, as HH:MM. One with seconds ("08:00:00", straight out of a
  // Postgres `time`) is trimmed, because that one is not something a person typed.
  const stored = /^\d{1,2}:\d{2}:\d{2}$/.test(String(value ?? '')) ? toHHMM(value) : value || ''
  const valid = isValidTime(stored)
  // What a person is TYPING, held here until they leave the field: reformatting
  // mid-word would turn "10:30" into "10:30AM" under the cursor, and the " PM"
  // they were about to type would land after it. Null while nobody is typing.
  const [draft, setDraft] = useState(null)
  // What the field shows: the draft while typing, else the stored time on the
  // 12-hour clock — or, for text that could not be read, exactly what was typed
  // (never a guess), with the field marked so it says so.
  const shown = draft ?? (valid ? formatTime(stored) : stored)
  const unreadable = draft === null && stored !== '' && !valid
  // A time being assembled in the list on an EMPTY field — hour and minute can be
  // picked before the half of the day is known. A stored time IS the selection.
  const [partial, setPartial] = useState(NOTHING)
  const sel = valid ? partsOf(stored) : partial

  const emit = (v) => onChange({ target: { value: v } })

  // ONE function owns placement: where there is room, and inside the screen.
  //
  // ⚠️ Measured, not assumed: a two-pass version (place, then a separate effect
  // that slid it back) left the list at x=417 on a 375px screen — the clamp only
  // re-ran when the coordinates changed, so a VIEWPORT change (a phone rotating,
  // a window resized) never re-evaluated it. Doing both here means there is no
  // state in which one has happened and the other hasn't.
  const place = () => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const wanted = 268
    const w = popRef.current?.offsetWidth || 176
    const below = window.innerHeight - r.bottom - 8
    const openUp = below < wanted && r.top > below
    const room = window.innerWidth >= 200 ? window.innerWidth - w - 8 : r.left
    setCoords({
      top: openUp ? Math.max(8, r.top - Math.min(wanted, r.top - 8) - 4) : r.bottom + 4,
      left: Math.max(8, Math.min(r.left, room)),
      maxHeight: Math.min(wanted, openUp ? r.top - 12 : below),
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
    // The field lives inside a scrollable modal, so a scroll has to move the
    // list with it — a `fixed` popover otherwise stays behind while the field it
    // belongs to slides away.
    const again = (e) => {
      // ⚠️ …but NOT a scroll inside the list itself. That is somebody flicking a
      // column, and re-placing on it re-rendered the list on every scroll tick and
      // re-ran the centring below — the column snapped back to the selected row
      // while it was being scrolled. Reported as "the scroll hangs".
      if (e?.target instanceof Node && popRef.current?.contains(e.target)) return
      place()
    }
    window.addEventListener('resize', again)
    // NOTE: `document`, not `window` — a scroll INSIDE a container (this app's
    // modals scroll) never reaches a capture listener on window; measured with a
    // probe. `document` is on the propagation path, which is why it is the idiom.
    document.addEventListener('scroll', again, true)
    return () => {
      window.removeEventListener('resize', again)
      document.removeEventListener('scroll', again, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Centre each column on what is selected — or, on an empty field, on the hour
  // a shoot actually starts at. ONCE per opening (and again when the arrow keys
  // move the value), never on a re-placement: centring on every render is what
  // fought the person scrolling. scrollTop, not scrollIntoView, which would also
  // scroll the page behind.
  const centred = useRef(false)
  const follow = useRef(false)
  const centre = () => {
    for (const col of [hourCol.current, minCol.current]) {
      const row = col?.querySelector('[data-at="true"]')
      if (row) col.scrollTop = row.offsetTop - col.clientHeight / 2 + row.offsetHeight / 2
    }
  }
  useLayoutEffect(() => {
    if (!open) {
      centred.current = false
      return
    }
    if (!coords || centred.current) return
    centred.current = true
    centre()
  }, [open, coords])
  useLayoutEffect(() => {
    if (!open || !follow.current) return
    follow.current = false
    centre()
  }, [open, stored])

  // A fresh list starts from the stored time, not from a half-built one.
  useEffect(() => {
    if (open) setPartial(NOTHING)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      const t = e.target
      if (!(t instanceof Node)) return setOpen(false)
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        // Escape closes the LIST, not the modal behind it.
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // One tap in any column. Once the hour AND the half of the day are known the
  // time is written (the minute is :00 unless one was picked); until then the
  // picks are held here. AM/PM is the last step of the usual order, so it closes.
  const pick = (column, v) => {
    setDraft(null)
    const next = { ...sel, [column]: v }
    if (next.h != null && next.p != null) {
      setPartial(NOTHING)
      const time = compose(next)
      if (time !== stored) emit(time)
      if (column === 'p') {
        setOpen(false)
        inputRef.current?.focus()
      }
      return
    }
    setPartial(next)
  }

  // Reads the INPUT, not the render closure. A handler that can fire before a
  // re-render must read the live value — the rule this codebase has written down
  // six times — and for a text field the DOM node IS that value.
  function snap() {
    // Nothing typed since the last pick: the list or the arrows already set it.
    if (draft === null) return
    const raw = (inputRef.current?.value ?? draft).trim()
    setDraft(null)
    // Unreadable text is LEFT ALONE — handed on as typed, so the form says what
    // is wrong with it: overwriting it with a guess would hide the typo rather
    // than fix it. An emptied field clears the time.
    const next = raw === '' ? '' : parseTimeInput(raw) || raw
    if (next !== stored) emit(next)
  }

  // While a time is being assembled on an empty field, the field says how far
  // it has got ("5:30 --") instead of looking untouched — only while the list is
  // open: closed, nothing was written, and the field must not suggest otherwise.
  const building = open && !valid && (partial.h != null || partial.m != null || partial.p != null)
  const placeholder = building
    ? `${partial.h ?? '--'}:${partial.m ?? '--'} ${partial.p ?? '--'}`
    : '--:-- --'

  const columns = [
    { key: 'h', label: 'Hour', ref: hourCol, rows: HOURS, at: sel.h ?? OPEN_AT_HOUR, show: String },
    { key: 'm', label: 'Min', ref: minCol, rows: MINUTES, at: sel.m ?? '00', show: (v) => `:${v}` },
    { key: 'p', label: '', ref: null, rows: PERIODS, at: null, show: String },
  ]

  return (
    <>
      <div ref={wrapRef} className="relative min-w-0">
        <input
          ref={inputRef}
          type="text"
          // A full keyboard, not the numeric pad: "5pm" needs its letters.
          autoComplete="off"
          aria-label={ariaLabel}
          aria-invalid={unreadable || undefined}
          placeholder={placeholder}
          maxLength={10}
          value={shown}
          onChange={(e) => setDraft(e.target.value)}
          onClick={() => setOpen(true)}
          onBlur={snap}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              // The list is a picker, not a keyboard trap: the arrows nudge the
              // VALUE, which is what a time field is expected to do — from what
              // is being typed, if anything is.
              const base = draft !== null ? parseTimeInput(draft) || stored : stored
              setDraft(null)
              follow.current = true
              emit(stepTime(base, e.key === 'ArrowDown' ? STEP : -STEP, `${pad(OPEN_AT_HOUR)}:00`))
              setOpen(true)
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              snap()
              setOpen(false)
            }
          }}
          // `min-w-0` + the full width: without them a bare input keeps its
          // intrinsic ~20-character size and overflows this wrapper, putting the
          // chevron on top of the text (the DateField lesson).
          // Text that couldn't be read is ringed in rose: a VARIANT, so it wins
          // over whatever border the caller passed (a plain utility would be
          // settled by stylesheet order, not intent).
          className={[
            className,
            'w-full pr-7 aria-invalid:border-rose-400 aria-invalid:ring-2 aria-invalid:ring-rose-100',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Pick a time"
          title="Pick a time"
          onClick={() => {
            setOpen((v) => !v)
            inputRef.current?.focus()
          }}
          className="absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronDown
            size={14}
            className={['transition', open ? 'rotate-180' : ''].join(' ')}
          />
        </button>
      </div>

      {open &&
        coords &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="z-[75] flex overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-xl"
          >
            {columns.map((col) => (
              <div
                key={col.key}
                className={[
                  'flex flex-col border-r border-slate-100 last:border-r-0',
                  col.key === 'p' ? 'w-[56px]' : 'w-[60px]',
                ].join(' ')}
              >
                <div className="shrink-0 border-b border-slate-100 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {/* A non-breaking space keeps the AM/PM column's header as tall
                      as the others, so the three columns' rows line up. */}
                  {col.label || ' '}
                </div>
                <div
                  ref={col.ref}
                  // `relative`: the centring measures a row's offsetTop against
                  // its column.
                  className="relative overflow-y-auto overscroll-contain"
                  style={{ maxHeight: Math.max(120, (coords.maxHeight ?? 240) - 26) }}
                >
                  {col.rows.map((v) => {
                    const selected = sel[col.key] === v
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={selected}
                        // Where to centre on open: the selection, or the hour a
                        // shoot plausibly starts at when nothing is set yet.
                        data-at={col.at === v ? 'true' : undefined}
                        onClick={() => pick(col.key, v)}
                        className={[
                          ROW,
                          'tabular-nums',
                          selected ? 'bg-brand font-semibold text-white' : 'text-slate-700 hover:bg-violet-50',
                        ].join(' ')}
                      >
                        {col.show(v)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
