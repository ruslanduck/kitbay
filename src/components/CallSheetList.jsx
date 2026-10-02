import { Fragment } from 'react'
import { scheduleLines } from '../lib/crew'
import { formatTime } from '../lib/clock'

// The call sheet as it is READ: one line per call — the time, the role and
// everyone called for it ("10AM · Model · Hailey Halter, Valery Kaufman"), the
// note if there is one — plus the wrap when the caller asks for it.
//
// One definition because three surfaces show this: the job card, the job's peek
// card and the shoot's peek card. Two of them had grown their own copy once, and
// a third was about to.
//
// The TIME is the thing being looked up ("when do I have to be there"), so it is
// set in a chip at the card's strongest text colour. A row nobody has given a
// time yet keeps the chip's place with a dash, so the roles still line up —
// unless the shoot has a general call, which such a row is called at: it shows
// that time, lighter, so it reads as inherited rather than typed. The wrap takes
// the same shape in outline: it is the end of the day, not somebody's call.
//
// `onPerson(name)` returns a click handler for a person the app knows (People),
// or null — so a name opens its card where it can and stays plain text where it
// can't. `wrapTime` is optional, and so is `callTime` — the shoot's GENERAL call
// (everyone, no role), which takes its place in the day by time.
export default function CallSheetList({
  crew,
  wrapTime = null,
  callTime = null,
  empty = 'not set',
  onPerson = null,
}) {
  const lines = scheduleLines(crew, callTime)
  if (!lines.length && !wrapTime) return <span className="text-slate-400">{empty}</span>
  return (
    <span className="flex flex-col items-start gap-1">
      {lines.map((c, i) => {
        return (
          <span key={c.id || i} className="flex items-baseline gap-2">
            <span
              title={c.atGeneral ? 'At the general call' : undefined}
              className={[
                'shrink-0 rounded-md px-1.5 py-0.5 text-sm tabular-nums ring-1',
                c.atGeneral
                  ? 'font-semibold text-slate-500 ring-slate-200'
                  : c.time
                    ? 'bg-slate-100 font-bold text-slate-900 ring-slate-200'
                    : 'font-semibold text-slate-400 ring-slate-200',
              ].join(' ')}
            >
              {c.time ? formatTime(c.time) : '—:—'}
            </span>
            <span className="min-w-0">
              <span className="font-medium text-slate-700">{c.general ? 'General call' : c.role}</span>
              {c.people.length > 0 && <span className="text-slate-400"> · </span>}
              {c.people.map((p, n) => {
                const open = onPerson ? onPerson(p.name) : null
                return (
                  <Fragment key={p.name}>
                    {n > 0 && <span className="text-slate-400">, </span>}
                    {open ? (
                      <button
                        type="button"
                        onClick={open}
                        className="text-violet-600 underline decoration-violet-300 underline-offset-2 hover:text-violet-800"
                      >
                        {p.name}
                      </button>
                    ) : (
                      <span className="text-slate-700">{p.name}</span>
                    )}
                  </Fragment>
                )
              })}
              {c.note && <span className="text-slate-400"> · {c.note}</span>}
            </span>
          </span>
        )
      })}
      {wrapTime && (
        <span className="flex items-baseline gap-2">
          <span className="shrink-0 rounded-md px-1.5 py-0.5 text-sm font-semibold tabular-nums text-slate-500 ring-1 ring-slate-300">
            {formatTime(wrapTime)}
          </span>
          <span className="text-slate-500">wrap</span>
        </span>
      )}
    </span>
  )
}
