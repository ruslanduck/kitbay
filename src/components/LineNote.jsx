import { useState } from 'react'
import { StickyNote } from 'lucide-react'

// An equipment line's note — typed under the line in the job's equipment window,
// printed in parentheses after the name on the packing list. On the job card it
// was nowhere, so the one place a note was read before the sheet came out was the
// window it was typed in.
//
// One line, cut with an ellipsis where the card runs out of room — as many of its
// first characters as fit, which a fixed count would get wrong on every width.
// The whole note is in the tooltip, and a click or tap opens it in place: a touch
// screen has no hover, and this app runs on iPads.
export default function LineNote({ text, className = '' }) {
  const [open, setOpen] = useState(false)
  const note = String(text ?? '').trim()
  if (!note) return null
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setOpen((v) => !v)
      }}
      title={open ? 'Show less' : note}
      aria-expanded={open}
      className={[
        'flex min-w-0 max-w-full items-start gap-1 rounded text-left text-xs text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
        className,
      ].join(' ')}
    >
      <StickyNote size={11} className="mt-0.5 shrink-0 text-slate-400" />
      <span className={open ? 'min-w-0 whitespace-pre-line break-words' : 'min-w-0 truncate'}>{note}</span>
    </button>
  )
}
