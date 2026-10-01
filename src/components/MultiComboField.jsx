import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Plus, X } from 'lucide-react'

// SEVERAL people in one field — wherever the app asks for a person: the job's
// assignees and every line of the call sheet. The client asked for "all crew",
// and a single combo box could only ever hold one person.
//
// Chips for who is in it (or, with `chips={false}`, only the box — the caller
// lists the picks itself, as the assignees do with a role beside each), a text
// box that narrows the list, and the same popover as ComboField (portal, fixed
// position, outside-click and Escape to close, flips above when there's no room
// below). Picking a row TOGGLES it and the list stays open, because the point
// of this control is picking more than one. A name the list doesn't have is
// allowed and said out loud — the caller files it into People on save.
//
// Options are names or `{ value, hint }`: the hint is what that person does as
// People files it, shown beside the name ("Marcus Reed · Photographer") and
// searchable too, so typing "stylist" lists the stylists.
//
// `onChange` takes an UPDATER, not a value: two picks before a re-render would
// otherwise both compute from the same `value` prop and the second would drop
// the first (the stale-value rule written down in CLAUDE.md).
const fold = (s) => String(s ?? '').trim().toLowerCase()
const asOption = (o) => (typeof o === 'object' && o !== null ? o : { value: o, hint: null })

const SIZES = {
  md: {
    box: 'min-h-[2.375rem] rounded-lg py-1.5 pl-2',
    chip: 'h-6',
    input: 'h-6',
    chevron: 'top-[0.5625rem]',
  },
  // Matches the call sheet's compact fields (30px).
  sm: {
    box: 'min-h-[1.875rem] rounded-md py-[3px] pl-1.5',
    chip: 'h-[22px]',
    input: 'h-[22px]',
    chevron: 'top-[0.3125rem]',
  },
}

export default function MultiComboField({
  value = [],
  onChange,
  options = [],
  placeholder,
  ariaLabel,
  className = '',
  chips = true,
  size = 'md',
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [active, setActive] = useState(-1)
  const [coords, setCoords] = useState(null)
  const boxRef = useRef(null)
  const inputRef = useRef(null)
  const popRef = useRef(null)
  const sz = SIZES[size] ?? SIZES.md

  const all = options.map(asOption)
  const chosen = new Set(value.map(fold))
  const q = fold(draft)
  const shown = q ? all.filter((o) => fold(o.value).includes(q) || fold(o.hint).includes(q)) : all
  // A typed name nobody on the list has — offered as the first row.
  const typed = q && !all.some((o) => fold(o.value) === q) && !chosen.has(q) ? draft.trim() : ''
  const rows = [
    ...(typed ? [{ name: typed, hint: null, isNew: true }] : []),
    ...shown.map((o) => ({ name: o.value, hint: o.hint, isNew: false })),
  ]
  // Picked, but not on the list — they are added to People when the job saves.
  const unknown = value.filter((n) => !all.some((o) => fold(o.value) === fold(n)))

  const place = () => {
    const el = boxRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const wanted = Math.min(Math.max(rows.length, 1) * 34 + 10, 256)
    const below = window.innerHeight - r.bottom - 8
    const openUp = below < wanted && r.top > below
    setCoords({
      top: openUp ? Math.max(8, r.top - Math.min(wanted, r.top - 8) - 4) : r.bottom + 4,
      left: r.left,
      // A call-sheet line's field is narrow; the list is never narrower than a
      // name and its trade need.
      width: Math.max(r.width, 240),
      maxHeight: Math.min(wanted, openUp ? r.top - 12 : below),
    })
  }

  // Re-placed when chips are added: a new line of chips moves the field's
  // bottom edge, and the list must stay attached to it.
  useLayoutEffect(() => {
    if (!open) return
    place()
    const onScroll = () => place()
    // `document`, not `window`: a scroll inside a modal never reaches a capture
    // listener on window (measured — see SelectField).
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rows.length, value.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      const t = e.target
      // `contains` throws on a target that isn't a Node; close unless the click
      // is provably inside (the StatusMenu lesson).
      if (t instanceof Node && (boxRef.current?.contains(t) || popRef.current?.contains(t))) return
      setOpen(false)
    }
    // Escape closes the list, not the modal behind it.
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const remove = (name) => onChange((cur) => cur.filter((n) => fold(n) !== fold(name)))
  const toggle = (name) =>
    onChange((cur) =>
      cur.some((n) => fold(n) === fold(name)) ? cur.filter((n) => fold(n) !== fold(name)) : [...cur, name],
    )

  function pickRow(row) {
    toggle(row.name)
    setDraft('')
    setActive(-1)
    inputRef.current?.focus()
  }

  // What was typed, as a name: the list's own spelling when it is on it.
  function addTyped() {
    const name = all.find((o) => fold(o.value) === q)?.value ?? draft.trim()
    if (!name) return
    onChange((cur) => (cur.some((n) => fold(n) === fold(name)) ? cur : [...cur, name]))
    setDraft('')
    setActive(-1)
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return setOpen(true)
      const dir = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (rows.length ? (i + dir + rows.length) % rows.length : -1))
    } else if (e.key === 'Enter') {
      // Enter here means "add", never "submit the job".
      e.preventDefault()
      if (open && active >= 0 && rows[active]) pickRow(rows[active])
      else addTyped()
    } else if (e.key === 'Backspace' && !draft && value.length && chips) {
      remove(value[value.length - 1])
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="min-w-0">
      <div
        ref={boxRef}
        onMouseDown={(e) => {
          // A click on the field's empty space lands in the text box.
          if (e.target === boxRef.current) {
            e.preventDefault()
            inputRef.current?.focus()
            setOpen(true)
          }
        }}
        className={[
          'relative flex w-full cursor-text flex-wrap items-center gap-1.5 border border-slate-300 bg-surface pr-7 text-sm transition focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100',
          sz.box,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {chips &&
          value.map((name) => (
            <span
              key={fold(name)}
              className={[
                'inline-flex max-w-full items-center gap-0.5 rounded-full bg-violet-50 pl-2.5 pr-1 text-xs font-medium text-violet-700 ring-1 ring-violet-200',
                sz.chip,
              ].join(' ')}
            >
              <span className="truncate">{name}</span>
              <button
                type="button"
                onClick={() => remove(name)}
                title={`Remove ${name}`}
                aria-label={`Remove ${name}`}
                className="shrink-0 rounded-full p-0.5 text-violet-400 transition hover:bg-violet-100 hover:text-violet-700"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          aria-label={ariaLabel}
          placeholder={chips && value.length ? '' : placeholder}
          onChange={(e) => {
            setDraft(e.target.value)
            setActive(-1)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          // As wide as what is in it, then it grows into the rest of the line:
          // two names and an empty box share one line, and a long name being
          // typed wraps to a line of its own instead of being typed blind.
          size={Math.max((draft || (chips && value.length ? '' : placeholder || '')).length + 1, 2)}
          className={[
            'min-w-0 flex-auto bg-transparent px-1 text-sm text-slate-900 outline-none placeholder:text-slate-400',
            sz.input,
          ].join(' ')}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setOpen((o) => !o)
            inputRef.current?.focus()
          }}
          title="Show the list"
          className={[
            'absolute right-1.5 rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600',
            sz.chevron,
          ].join(' ')}
        >
          <ChevronDown size={15} className={['transition', open ? 'rotate-180' : ''].join(' ')} />
        </button>
      </div>

      {/* Free entry, said where it happens: a name People doesn't have is filed
          there on save. */}
      {unknown.length > 0 && (
        <p className="mt-1 text-[11px] text-slate-500">
          {unknown.map((n) => `“${n}”`).join(', ')} {unknown.length === 1 ? 'is' : 'are'} not in People yet —
          added when you save.
        </p>
      )}

      {open &&
        coords &&
        createPortal(
          <div
            ref={popRef}
            role="listbox"
            aria-multiselectable="true"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxWidth: 'calc(100vw - 16px)',
              maxHeight: coords.maxHeight,
            }}
            className="z-[70] overflow-auto rounded-xl border border-slate-200 bg-surface py-1 shadow-xl"
          >
            {rows.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">
                {q ? 'Already picked.' : 'Nothing to choose from yet.'}
              </p>
            )}
            {rows.map((r, i) => {
              const selected = !r.isNew && chosen.has(fold(r.name))
              return (
                <button
                  key={`${r.isNew ? 'new:' : ''}${r.name}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  // Keep the cursor in the text box, so the next name can be
                  // typed straight after a pick.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pickRow(r)}
                  className={[
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition',
                    r.isNew ? 'text-violet-600' : selected ? 'font-medium text-violet-700' : 'text-slate-700',
                    i === active ? 'bg-violet-50' : '',
                  ].join(' ')}
                >
                  {r.isNew ? (
                    <Plus size={14} className="shrink-0" />
                  ) : (
                    <Check size={14} className={['shrink-0', selected ? 'text-violet-600' : 'invisible'].join(' ')} />
                  )}
                  <span className="min-w-0 flex-1 truncate">{r.isNew ? `Add “${r.name}”` : r.name}</span>
                  {r.hint && <span className="shrink-0 text-xs font-normal text-slate-400">{r.hint}</span>}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
