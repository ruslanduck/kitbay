import { useMemo } from 'react'
import { useStore } from '../store'
import { buildIndex, describeItem } from './search'

// The inventory's search index (lib/search), built once per register or
// taxonomy change — every keystroke only reads it. Each picker calls this with
// the items it was handed; the taxonomy is read here, so a picker needs no new
// prop to search by category and subcategory (a prop threaded through a shared
// modal is how one once white-screened the calendar).
export function useItemIndex(items) {
  const taxonomy = useStore((s) => s.taxonomy)
  return useMemo(() => buildIndex(items ?? [], describeItem(taxonomy)), [items, taxonomy])
}
