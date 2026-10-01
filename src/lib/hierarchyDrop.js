// Drag & drop in the Inventory Hierarchy: what a drop MEANS, decided in one pure
// place so the window only has to ask. Two things can be carried — items (one,
// or everything ticked) and a subcategory — and three kinds of place can take
// them: a subcategory, a category, and "Not filed".
//
// The rule the whole hierarchy rests on holds here too: an item lives in a
// SUBCATEGORY, never in a category directly — so an item dropped on a category
// is refused with the reason, not quietly filed somewhere nobody picked.
//
// PURE — no React, no DOM — so `npm run test:lib` can assert every verdict.

import {
  categoryById,
  subcategoryById,
  subcategoryNameError,
  subcategoryPath,
} from './taxonomy.js'

const live = (row) => !!row && !row.archivedAt
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const name = (s) => String(s ?? '').trim()

// Where a target is, for the summary line: "Grip / Clamps", "Grip", "Not filed".
function placeName(target, tax) {
  if (target?.kind === 'unfiled') return 'Not filed'
  if (target?.kind === 'cat') return name(categoryById(tax, target.id)?.name)
  if (target?.kind === 'sub') return subcategoryPath(subcategoryById(tax, target.id), tax)
  return ''
}

// What a drag carries, as the ghost under the pointer reads it.
export function dragLabel(payload, items, tax) {
  if (payload?.kind === 'sub') return name(subcategoryById(tax, payload.id)?.name) || 'Subcategory'
  const ids = payload?.ids ?? []
  if (ids.length === 1) return name((items ?? []).find((i) => i.id === ids[0])?.name) || '1 inventory entry'
  return plural(ids.length, 'inventory entry', 'inventory entries')
}

// The verdict for dropping `payload` on `target`:
//   { ok: true, move }            — do it; `move` is what the store is asked
//   { ok: false, noop: true }     — it is already there; nothing to say
//   { ok: false, reason }         — refused, and this is why
export function dropVerdict(payload, target, tax, items) {
  if (!payload || !target) return { ok: false, noop: true }

  if (payload.kind === 'item') {
    const carried = (items ?? []).filter((i) => (payload.ids ?? []).includes(i.id) && !i.archivedAt)
    if (!carried.length) return { ok: false, reason: 'That inventory is no longer in the register.' }
    if (target.kind === 'cat') return { ok: false, reason: 'Inventory goes in a subcategory — drop it on one.' }
    let subcategoryId
    if (target.kind === 'unfiled') subcategoryId = null
    else if (target.kind === 'sub') {
      const sub = subcategoryById(tax, target.id)
      if (!live(sub)) return { ok: false, reason: 'That subcategory no longer exists.' }
      subcategoryId = sub.id
    } else return { ok: false, noop: true }
    // Only the pieces that actually move: a drag that gathered some already
    // filed here moves the rest and says so by its count.
    const moving = carried.filter((i) => (i.subcategoryId ?? null) !== subcategoryId)
    if (!moving.length) return { ok: false, noop: true }
    return {
      ok: true,
      move: {
        type: 'items',
        ids: moving.map((i) => i.id),
        subcategoryId,
        to: placeName(target, tax),
      },
    }
  }

  if (payload.kind === 'sub') {
    const sub = subcategoryById(tax, payload.id)
    if (!live(sub)) return { ok: false, reason: 'That subcategory no longer exists.' }
    if (target.kind === 'unfiled')
      return { ok: false, reason: 'A subcategory always belongs to a category.' }
    // Dropped on a category, it moves there; dropped on another subcategory, it
    // moves to THAT one's category — a row is a bigger target than a header.
    const categoryId =
      target.kind === 'cat'
        ? target.id
        : target.kind === 'sub'
          ? subcategoryById(tax, target.id)?.categoryId
          : null
    const cat = categoryById(tax, categoryId)
    if (!live(cat)) return { ok: false, reason: 'That category no longer exists.' }
    if (cat.id === sub.categoryId) return { ok: false, noop: true }
    const clash = subcategoryNameError(sub.name, tax, cat.id, { exceptId: sub.id })
    if (clash) return { ok: false, reason: clash }
    return {
      ok: true,
      move: {
        type: 'sub',
        id: sub.id,
        categoryId: cat.id,
        fromCategoryId: sub.categoryId,
        to: name(cat.name),
      },
    }
  }

  return { ok: false, noop: true }
}

// How to put a move back, worked out BEFORE the move happens: a drag of ticked
// items may have gathered them from several places, so each goes home to its
// own subcategory (or back to Not filed).
export function undoPlan(move, items) {
  if (move?.type === 'items') {
    const groups = new Map()
    for (const id of move.ids) {
      const from = (items ?? []).find((i) => i.id === id)?.subcategoryId ?? null
      const k = from ?? ''
      if (!groups.has(k)) groups.set(k, { subcategoryId: from, ids: [] })
      groups.get(k).ids.push(id)
    }
    return { type: 'items', groups: [...groups.values()] }
  }
  if (move?.type === 'sub') return { type: 'sub', id: move.id, categoryId: move.fromCategoryId }
  return null
}

// The line the window prints once a move has landed.
export function moveSummary(move, items, tax) {
  if (move?.type === 'items') {
    const what =
      move.ids.length === 1
        ? `“${name((items ?? []).find((i) => i.id === move.ids[0])?.name) || '1 inventory entry'}”`
        : plural(move.ids.length, 'inventory entry', 'inventory entries')
    return `Moved ${what} to ${move.to}`
  }
  if (move?.type === 'sub') {
    const sub = name(subcategoryById(tax, move.id)?.name) || 'the subcategory'
    return `Moved “${sub}” to ${move.to}`
  }
  return ''
}
