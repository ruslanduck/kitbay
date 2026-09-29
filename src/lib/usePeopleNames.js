import { useMemo } from 'react'
import { useStore } from '../store'
import { peopleNames } from './peopleOptions'
import { crewNames } from './crew'

// The pickers read the roster THEMSELVES instead of taking it as a prop.
//
// Two reasons, both learnt here: a list threaded through a parent is how one
// surface ends up offering something another doesn't (the calendar handed
// `OrderEditorModal` a frozen constant while the Jobs screen handed it the
// merged one), and it is the same shape of bug as the required prop a shared
// modal once lost.
//
// `orders`/`bookings` change identity on every quiet refetch, so this recomputes
// often — it is a derived list of a few dozen strings, and being always current
// is the point: add a person in People and the next picker you open has them,
// with no reload.
//
// The job's ASSIGNEE: anyone in People — asked for in so many words ("кого угодно
// с People"), so no trade is put first: everyone in name order, then any name
// already on a job that People doesn't have (so a job's own value stays
// offerable). Read live from the store, so a person filed in People a moment ago
// is offered the next time the form opens.
export function useAssigneeNames() {
  const people = useStore((s) => s.people)
  const orders = useStore((s) => s.orders)
  return useMemo(
    () => peopleNames(people, { used: (orders ?? []).map((o) => o.photographer) }),
    [people, orders],
  )
}

//
// The person picker on a call-sheet row: the people whose trade IS the row's
// role first ("Stylist" offers the stylists, "Model" the models), then everyone
// else, then any name already written on a sheet that People doesn't have. One
// hook for every row, because a Photographer field and a Model field were two
// copies of this rule and the sheet has as many roles as the studio types.
// Returns `(role) => names`, cached per role for the life of the lists.
export function useCrewNameOptions() {
  const people = useStore((s) => s.people)
  const orders = useStore((s) => s.orders)
  const bookings = useStore((s) => s.bookings)
  return useMemo(() => {
    const used = [
      ...(bookings ?? []).flatMap((b) => crewNames(b.crew)),
      // A job with no shoot of its own still carries its photographer's name.
      ...(orders ?? []).map((o) => o.photographer),
    ]
    const cache = new Map()
    return (role) => {
      const key = String(role ?? '').trim().toLowerCase()
      if (!cache.has(key)) cache.set(key, peopleNames(people, { role, used }))
      return cache.get(key)
    }
  }, [people, orders, bookings])
}
