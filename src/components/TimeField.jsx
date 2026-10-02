import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'
import { isValidTime, minuteOptions, parseTimeInput, stepTime, toHHMM } from '../lib/callTimes'
import { formatTime } from '../lib/clock'

// The one time field in the app — a call time, the general call, and the wrap.
//
// Locale-proof by construction: a native <input type="time"> has its placeholder
// and its own picker drawn by the OPERATING SYSTEM (чч:мм on a Russian browser,
// unstyleable), which is the same trade DateField and SelectField already made.
// So the field is a text input and the card below is ours. It SHOWS the 12-hour
// clock the studio works in ("5PM", lib/clock) and hands its parent "HH:MM",
// 24-hour — the stored shape, which sorts as text.
//
// THREE ways to set a time, because a phone and a desk are not the same hand:
//   • the CARD — every hour, every minute and AM/PM at once, in the order a
//     12-hour time is picked: HOUR (12, 1 … 11), MINUTE, then AM/PM. Three taps
//     and no scrolling. It replaced three flickable columns that showed five
//     rows at a time, so most picks were a scroll and a hunt — and on Windows
//     each column wore its own grey scrollbar. Nothing is written until the hour
//     AND the half of the day are known — the field never guesses AM or PM — and
//     the minute is :00 unless one is picked. The AM/PM tap is the last step, so
//     it closes the card.
//   • TYPING — "5pm" · "5:30p" · "530pm" · "8" · "17:30" all snap on blur or
//     Enter (lib/callTimes `parseTimeInput`). Nobody has to reach for the colon,
//     and whoever types the 24-hour clock is still understood.
//   • ARROW KEYS — ±5 minutes, for correcting a value without retyping it.
const STEP = 5
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTES = minuteOptions(STEP)
const PERIODS = ['AM', 'PM']
// Where the arrow keys start on an empty field. A studio calls people in the
// morning, not at 12AM.
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

// One look for every cell. 32px tall with a mouse, 40px under a finger
// (`pointer-coarse`), so a phone gets a thumb-sized target without a desk
// paying for it in height.
const CELL =
  'flex h-8 items-center justify-center rounded-md text-sm tabular-nums transition pointer-coarse:h-10'
const HEAD = 'px-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400'
// The quarter hours are what a call sheet mostly says, so the other minutes are
// a step quieter — they sit in the second and third column, out of the way.
const tone = (selected, quiet = false) =>
  selected
    ? 'bg-brand font-semibold text-white'
    : [quiet ? 'text-slate-500' : 'text-slate-700', 'hover:bg-violet-50 hover:text-violet-700'].join(' ')

function Group({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      {/* A label-less group still carries the header line, so all three
          groups' cells start on the same row. */}
      <div className={HEAD}>{label || '\u00a0'}</div>
      {children}
    </div>
  )
}

export default function TimeField({ value, onChange, className, ariaLabel, placeholder = 'Set time' }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const popRef = useRef(null)

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
  // A time being assembled on the card on an EMPTY field — hour and minute can
  // be picked before the half of the day is known. A stored time IS the selection.
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
    // The card's own size once it is on screen; before its first paint, about
    // what it measures.
    const w = popRef.current?.offsetWidth || 340
    const h = popRef.current?.offsetHeight || 190
    const below = window.innerHeight - r.bottom - 8
    const openUp = below < h && r.top > below
    const room = window.innerWidth >= 200 ? window.innerWidth - w - 8 : r.left
    setCoords({
      top: openUp ? Math.max(8, r.top - h - 4) : r.bottom + 4,
      left: Math.max(8, Math.min(r.left, room)),
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
    // The field lives inside a scrollable modal, so a scroll has to move the
    // card with it — a `fixed` popover otherwise stays behind while the field it
    // belongs to slides away.
    const again = () => place()
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

  // The first placement had to guess the card's size. Once it is on screen it is
  // placed again from what it really measures — whether it fits below the field
  // or opens above it depends on its height, which is taller under a finger.
  // Once per opening, held in a ref so the re-placement can't loop.
  const measured = useRef(false)
  useLayoutEffect(() => {
    if (!open) {
      measured.current = false
      return
    }
    if (!coords || measured.current) return
    measured.current = true
    place()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, coords])

  // A fresh card starts from the stored time, not from a half-built one.
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
        // Escape closes the CARD, not the modal behind it.
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

  // One tap on the card. Once the hour AND the half of the day are known the
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
    // Nothing typed since the last pick: the card or the arrows already set it.
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
  // it has got ("5:30 --") instead of looking untouched — only while the card is
  // open: closed, nothing was written, and the field must not suggest otherwise.
  const building = open && !valid && (partial.h != null || partial.m != null || partial.p != null)
  const hint = building ? `${partial.h ?? '--'}:${partial.m ?? '--'} ${partial.p ?? '--'}` : placeholder

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
          placeholder={hint}
          maxLength={10}
          value={shown}
          onChange={(e) => setDraft(e.target.value)}
          onClick={() => setOpen(true)}
          onBlur={snap}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              // The card is a picker, not a keyboard trap: the arrows nudge the
              // VALUE, which is what a time field is expected to do — from what
              // is being typed, if anything is.
              const base = draft !== null ? parseTimeInput(draft) || stored : stored
              setDraft(null)
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
          // clock on top of the text (the DateField lesson). `pr-8` keeps the
          // value clear of it.
          // Text that couldn't be read is ringed in rose: a VARIANT, so it wins
          // over whatever border the caller passed (a plain utility would be
          // settled by stylesheet order, not intent).
          className={[
            className,
            'w-full pr-8 aria-invalid:border-rose-400 aria-invalid:ring-2 aria-invalid:ring-rose-100',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {/* A clock, where DateField keeps its calendar — the same box, size and
            colour. The chevron it replaced made a time read as one more
            dropdown. Lit while the card is open, so the field says whose card
            it is. */}
        <button
          type="button"
          tabIndex={-1}
          aria-label="Pick a time"
          aria-expanded={open}
          title="Pick a time"
          onClick={() => {
            setOpen((v) => !v)
            inputRef.current?.focus()
          }}
          className={[
            'absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 transition',
            open ? 'bg-slate-100 text-slate-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
          ].join(' ')}
        >
          <Clock size={16} />
        </button>
      </div>

      {open &&
        coords &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="z-[75] flex gap-2 rounded-xl border border-slate-200 bg-surface p-2 shadow-xl"
          >
            <Group label="Hour">
              <div className="grid grid-cols-3 gap-1">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={sel.h === h}
                    onClick={() => pick('h', h)}
                    className={[CELL, 'w-9', tone(sel.h === h)].join(' ')}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </Group>
            <div className="w-px self-stretch bg-slate-100" />
            <Group label="Min">
              <div className="grid grid-cols-3 gap-1">
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={sel.m === m}
                    onClick={() => pick('m', m)}
                    className={[CELL, 'w-10', tone(sel.m === m, Number(m) % 15 !== 0)].join(' ')}
                  >
                    :{m}
                  </button>
                ))}
              </div>
            </Group>
            <div className="w-px self-stretch bg-slate-100" />
            {/* AM / PM: two tall buttons that fill the grid's height — the last
                tap of the three, and the biggest target on the card. */}
            <Group>
              <div className="flex flex-1 flex-col gap-1">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={sel.p === p}
                    onClick={() => pick('p', p)}
                    className={[
                      'flex w-11 flex-1 items-center justify-center rounded-md text-sm font-medium transition',
                      tone(sel.p === p),
                    ].join(' ')}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Group>
          </div>,
          document.body,
        )}
    </>
  )
}
