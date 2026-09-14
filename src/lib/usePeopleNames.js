import { useMemo } from 'react'
import { useStore } from '../store'
import { peopleNames } from './peopleOptions'

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
export function usePhotographerNames() {
  const people = useStore((s) => s.people)
  const orders = useStore((s) => s.orders)
  const bookings = useStore((s) => s.bookings)
  return useMemo(
    () =>
      peopleNames(people, {
        role: 'Photographer',
        used: [
          ...(orders ?? []).map((o) => o.photographer),
          ...(bookings ?? []).map((b) => b.photographer),
        ],
      }),
    [people, orders, bookings],
  )
}

export function useModelNames() {
  const people = useStore((s) => s.people)
  const bookings = useStore((s) => s.bookings)
  return useMemo(
    () => peopleNames(people, { role: 'Model', used: (bookings ?? []).map((b) => b.model) }),
    [people, bookings],
  )
}
