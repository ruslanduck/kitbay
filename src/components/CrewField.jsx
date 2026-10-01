import { useRef } from 'react'
import { Plus, X, Clock, AlertTriangle } from 'lucide-react'
import TimeField from './TimeField'
import OtherSelectField from './OtherSelectField'
import MultiComboField from './MultiComboField'
import { crewRowProblem, wrapBeforeFirstCrewCall } from '../lib/crew'
import { CALL_ROLES, isValidTime, toHHMM } from '../lib/callTimes'
import { useCrewNameOptions } from '../lib/usePeopleNames'

// The call sheet, the studio's own design: every line is TIME · ROLE · PEOPLE —
// "10:00 · Model · Hailey Halter, Valery Kaufman" — and a line may call several
// people ("всю команду можно выбирать — несколько людей"). The form edits LINES
// (`lib/crew` groupCrew); the database keeps one row per person (expandCrew on
// save), because that row is what puts a person on the shoot.
//
// The people come from People — those whose trade IS the line's role first, each
// shown with their trade — or are typed; a typed name is filed into People on
// save. Time and people are optional (a role can be listed before anyone is
// booked); the role is not.
//
// The roles are the studio's fixed list plus Other, with the role typed beside
// it: a role typed through the old in-menu "Other…" joined the list for every
// shoot, and prod's list still offered a test "eee".
//
// Shared by the job form and the legacy shoot editor, so both have one control.
// `onChange` takes an UPDATER, not a value: two edits before a re-render would
// otherwise both compute from the same `value` prop and the second would drop
// the first (the stale-value rule written down in CLAUDE.md).
export default function CrewField({
  value = [],
  onChange,
  wrapTime = '',
  onWrapChange,
}) {
  // A key that survives removing a row in the middle: a DB row has an id, a new
  // one gets a local uid (dropped by normalizeCrew on save).
  const uid = useRef(0)
  const namesFor = useCrewNameOptions()
  const rows = value

  const patch = (i, changes) =>
    onChange((cur) => cur.map((r, n) => (n === i ? { ...r, ...changes } : r)))
  const add = () => {
    uid.current += 1
    onChange((cur) => [...cur, { uid: `new-${uid.current}`, role: '', people: [], time: '', note: '' }])
  }
  const remove = (i) => onChange((cur) => cur.filter((_, n) => n !== i))

  const label = 'mb-1.5 block text-sm font-medium text-slate-700'
  const small =
    'w-full rounded-md border border-slate-300 px-2 py-1 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100'
  const field =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100'
  const wrapEarly = wrapBeforeFirstCrewCall(rows, wrapTime)

  return (
    <div className="space-y-3">
      <div>
        <label className={label}>Call times</label>

        {rows.length > 0 && (
          <ul className="mb-2 space-y-2">
            {rows.map((r, i) => {
              const problem = crewRowProblem(r)
              const badTime = !!r.time && !isValidTime(toHHMM(r.time))
              return (
                <li
                  key={r.id || r.uid || i}
                  className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-200"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center text-slate-400">
                      <Clock size={13} />
                    </span>
                    {/* TimeField's input is `w-full` of its own wrapper, so the
                        WIDTH is set here — a width class on the input loses. */}
                    <div className="w-[5.5rem] shrink-0">
                      <TimeField
                        value={r.time ?? ''}
                        onChange={(e) => patch(i, { time: e.target.value })}
                        ariaLabel="Call time"
                        className={[
                          'rounded-md border px-2 py-1 text-sm outline-none transition focus:ring-2',
                          badTime
                            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
                            : 'border-slate-300 focus:border-violet-400 focus:ring-violet-100',
                        ].join(' ')}
                      />
                    </div>
                    <OtherSelectField
                      value={r.role ?? ''}
                      onChange={(e) => patch(i, { role: e.target.value })}
                      options={CALL_ROLES}
                      placeholder="Role"
                      ariaLabel="Role"
                      detailPlaceholder="Which role?"
                      detailAriaLabel="Which role"
                      className="min-w-[8rem] flex-1"
                      otherClassName="min-w-[14rem] flex-[1.5]"
                      selectClassName={small}
                      detailClassName={small}
                    />
                    <div className="min-w-[10rem] flex-[2]">
                      {/* A person kept keeps the contact the line was read with;
                          a new name is resolved again on save. */}
                      <MultiComboField
                        size="sm"
                        value={(r.people ?? []).map((p) => p.name)}
                        onChange={(fn) =>
                          onChange((cur) =>
                            cur.map((line, n) => {
                              if (n !== i) return line
                              const had = line.people ?? []
                              const names = fn(had.map((p) => p.name))
                              return {
                                ...line,
                                people: names.map(
                                  (name) =>
                                    had.find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? {
                                      name,
                                      contactId: null,
                                    },
                                ),
                              }
                            }),
                          )
                        }
                        options={namesFor(r.role)}
                        placeholder="People"
                        ariaLabel="People"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      title="Remove this call time"
                      aria-label="Remove this call time"
                      className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-surface hover:text-rose-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={r.note ?? ''}
                    onChange={(e) => patch(i, { note: e.target.value })}
                    placeholder="Note"
                    className={[small, 'mt-2'].join(' ')}
                  />
                  {/* Said where the row is, rather than refused at the button. */}
                  {problem && <p className="mt-1.5 text-[11px] text-amber-600">{problem}</p>}
                </li>
              )
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
        >
          <Plus size={13} />
          Add call time
        </button>
      </div>

      {/* The wrap is one time for the whole shoot, not somebody's call. */}
      <div>
        <label className={label}>Shoot wrap time</label>
        <TimeField
          value={wrapTime}
          onChange={(e) => onWrapChange(e.target.value)}
          className={[field, 'sm:w-32'].join(' ')}
        />
        {wrapEarly ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-rose-600">
            <AlertTriangle size={12} />
            That is before the first call.
          </p>
        ) : null}
      </div>
    </div>
  )
}
