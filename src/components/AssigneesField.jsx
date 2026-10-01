import { X } from 'lucide-react'
import MultiComboField from './MultiComboField'
import OtherSelectField from './OtherSelectField'
import { CALL_ROLES } from '../lib/callTimes'
import { canonicalRole } from '../lib/crew'
import { useAssigneeNames, usePersonTrades } from '../lib/usePeopleNames'

// The job's ASSIGNEES: the whole crew, each person with their ROLE on this job,
// read as a list "Marcus Reed (Photographer)" — asked for in so many words
// ("много людей а не одного … в формате имя (роль)").
//
// A picked person starts with what People says they do (their trade, or Model),
// put in the call sheet's own spelling when it is one of its roles, and the
// role can be changed for this job without touching their profile. The roles
// are the call sheet's list plus Other, with the role typed beside it — the
// same control and the same words as Call times.
//
// `value` is `[{ name, role }]`; `onChange` takes an UPDATER (the stale-value
// rule: two picks before a re-render must not drop one).
const fold = (s) => String(s ?? '').trim().toLowerCase()

export default function AssigneesField({ value = [], onChange }) {
  const options = useAssigneeNames()
  const trades = usePersonTrades()
  const roleFor = (name) => {
    const trade = trades.get(fold(name))
    return trade ? canonicalRole(trade) : null
  }
  const setRole = (name, role) =>
    onChange((cur) => cur.map((a) => (fold(a.name) === fold(name) ? { ...a, role: role || null } : a)))
  const remove = (name) => onChange((cur) => cur.filter((a) => fold(a.name) !== fold(name)))

  const small =
    'w-full rounded-md border border-slate-300 px-2 py-1 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100'

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-lg ring-1 ring-slate-200">
          {value.map((a) => (
            <li key={fold(a.name)} className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 sm:flex-nowrap">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800" title={a.name}>
                {a.name}
              </span>
              <OtherSelectField
                value={a.role ?? ''}
                onChange={(e) => setRole(a.name, e.target.value)}
                options={CALL_ROLES}
                placeholder="Role"
                ariaLabel={`Role of ${a.name}`}
                detailPlaceholder="Which role?"
                detailAriaLabel={`Which role for ${a.name}`}
                // On a phone the name and its × share the first line and the
                // role takes the second; from `sm` all three sit in one row.
                className="order-last w-full sm:order-none sm:w-44"
                otherClassName="order-last w-full sm:order-none sm:w-72"
                selectClassName={small}
                detailClassName={small}
              />
              <button
                type="button"
                onClick={() => remove(a.name)}
                title={`Remove ${a.name}`}
                aria-label={`Remove ${a.name}`}
                className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-rose-500"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* The picker toggles PEOPLE; the role each one gets is decided here, so a
          name added twice by mistake keeps the role it already had. */}
      <MultiComboField
        chips={false}
        value={value.map((a) => a.name)}
        onChange={(fn) =>
          onChange((cur) => {
            const names = fn(cur.map((a) => a.name))
            return names.map(
              (n) => cur.find((a) => fold(a.name) === fold(n)) ?? { name: n, role: roleFor(n) },
            )
          })
        }
        options={options}
        placeholder={value.length ? 'Add more people…' : 'Add people…'}
        ariaLabel="Assignees"
      />
    </div>
  )
}
