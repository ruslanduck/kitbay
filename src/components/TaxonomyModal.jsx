import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  Inbox,
  Package,
  Pencil,
  Plus,
  Undo2,
  X,
} from 'lucide-react'
import Modal from './Modal'
import ErrorNote from './ErrorNote'
import SelectField from './SelectField'
import { useStore } from '../store'
import { useCan } from '../lib/useCan'
import { CAP } from '../lib/permissions'
import { itemCount } from '../data/inventory'
import {
  UNASSIGNED,
  categoryRemovalBlock,
  liveCategories,
  subcategoryOptions,
  subcategoryRemovalBlock,
  subcategoryRemovalNote,
  taxonomyTree,
  unassignedByFormerCategory,
} from '../lib/taxonomy'
import { dragLabel, dropVerdict, moveSummary, undoPlan } from '../lib/hierarchyDrop'
import { useTreeDrag } from '../lib/useTreeDrag'

// The INVENTORY HIERARCHY: Category → Subcategory → Item, managed in one place.
//
// It used to be called "Categories", which named one of its two levels and none
// of what it is for — organising the register. The levels keep their own names
// (Category, Subcategory) and the window says the order they nest in.
//
// The tree is shown WITH ITS COUNTS, because every action here depends on them:
// a category with stock in it cannot go, and the crew should be able to see why
// before clicking rather than being told after. Removing either level ARCHIVES
// it (the app holds no DELETE — 20260808120000), so nothing is destroyed; the
// name keeps resolving for the records that still point at it.
//
// Organising is DRAG & DROP (lib/useTreeDrag + the pure verdicts in
// lib/hierarchyDrop): a subcategory opens to list its items; an item — or every
// ticked item — is dragged onto a subcategory, or onto "Not filed"; a
// subcategory is dragged onto another category and its items follow. An item is
// never filed under a category directly, so a drop on one is refused with the
// reason. "Move to…" does the same without a drag (keyboard, a small screen),
// and every move can be put back with Undo.

const FIELD =
  'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100'

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
// A click inside a control is the control's, not the row's.
const onControl = (e) => !!e.target.closest?.('button, input, a, [role="option"]')

export default function TaxonomyModal({ open, onClose }) {
  const taxonomy = useStore((s) => s.taxonomy)
  const inventory = useStore((s) => s.inventory)
  const createCategory = useStore((s) => s.createCategory)
  const renameCategory = useStore((s) => s.renameCategory)
  const removeCategory = useStore((s) => s.removeCategory)
  const createSubcategory = useStore((s) => s.createSubcategory)
  const updateSubcategory = useStore((s) => s.updateSubcategory)
  const removeSubcategory = useStore((s) => s.removeSubcategory)
  const assignItemsSubcategory = useStore((s) => s.assignItemsSubcategory)
  const can = useCan()
  const mayEdit = can(CAP.INVENTORY_EDIT)

  const [error, setError] = useState(null)
  const [newCat, setNewCat] = useState('')
  // Which row is being renamed / which category is taking a new subcategory,
  // and which removal is waiting for a confirm. One at a time, on purpose.
  const [editing, setEditing] = useState(null) // {kind:'cat'|'sub', id, name, categoryId}
  const [adding, setAdding] = useState(null) // categoryId
  const [addName, setAddName] = useState('')
  const [confirm, setConfirm] = useState(null) // {kind, id, name}
  // What is open: categories start OPEN (collapsing is the exception), a
  // subcategory's item list starts CLOSED (276 items open at once is a wall).
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [openSubs, setOpenSubs] = useState(() => new Set())
  const [unfiledOpen, setUnfiledOpen] = useState(false)
  // Ticked items travel together — a drag of any one of them carries them all.
  const [selected, setSelected] = useState(() => new Set())
  // The last move, with what it takes to put it back.
  const [done, setDone] = useState(null) // { text, plan }

  useEffect(() => {
    if (!open) return
    setError(null)
    setNewCat('')
    setEditing(null)
    setAdding(null)
    setAddName('')
    setConfirm(null)
    setCollapsed(new Set())
    setOpenSubs(new Set())
    setUnfiledOpen(false)
    setSelected(new Set())
    setDone(null)
  }, [open])

  const tree = useMemo(() => taxonomyTree(taxonomy, inventory), [taxonomy, inventory])
  const categories = useMemo(() => liveCategories(taxonomy), [taxonomy])
  // Each subcategory's live items, by name — read when its list is opened.
  const itemsBySub = useMemo(() => {
    const map = new Map()
    for (const item of inventory) {
      if (item.archivedAt || !item.subcategoryId) continue
      if (!map.has(item.subcategoryId)) map.set(item.subcategoryId, [])
      map.get(item.subcategoryId).push(item)
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    return map
  }, [inventory])
  const unfiledGroups = useMemo(
    () =>
      unassignedByFormerCategory(inventory).map((g) => ({
        ...g,
        items: g.items.slice().sort((a, b) => a.name.localeCompare(b.name)),
      })),
    [inventory],
  )
  const unfiledCount = unfiledGroups.reduce((n, g) => n + g.items.length, 0)
  const moveOptions = useMemo(
    () => [
      ...subcategoryOptions(taxonomy).map((o) => ({ value: o.value, label: o.label })),
      { value: UNASSIGNED, label: 'Not filed' },
    ],
    [taxonomy],
  )

  const run = async (fn) => {
    const res = await fn()
    setError(res?.error ?? null)
    return !res?.error
  }

  async function addCategory() {
    if (!newCat.trim()) return
    if (await run(() => createCategory(newCat))) setNewCat('')
  }

  async function addSubcategory(categoryId) {
    if (!addName.trim()) return
    if (await run(() => createSubcategory(categoryId, addName))) {
      setAddName('')
      setAdding(null)
    }
  }

  async function saveEdit() {
    if (!editing) return
    const ok =
      editing.kind === 'cat'
        ? await run(() => renameCategory(editing.id, editing.name))
        : await run(() =>
            updateSubcategory(editing.id, { name: editing.name, categoryId: editing.categoryId }),
          )
    if (ok) setEditing(null)
  }

  async function doRemove() {
    if (!confirm) return
    const ok =
      confirm.kind === 'cat'
        ? await run(() => removeCategory(confirm.id))
        : await run(() => removeSubcategory(confirm.id))
    if (ok) setConfirm(null)
  }

  // ─────────────────────────────────────────────── moving things

  // One path for a drop and for "Move to…": the plan to put it back is worked
  // out BEFORE the move, from where everything is now.
  async function applyMove(move) {
    const plan = undoPlan(move, inventory)
    const text = moveSummary(move, inventory, taxonomy)
    const res =
      move.type === 'items'
        ? await assignItemsSubcategory(move.ids, move.subcategoryId)
        : await updateSubcategory(move.id, { categoryId: move.categoryId })
    if (res?.error) {
      setError(res.error)
      return
    }
    setError(null)
    setDone({ text, plan })
    if (move.type === 'items') setSelected(new Set())
  }

  async function undo() {
    const plan = done?.plan
    if (!plan) return
    setDone(null)
    if (plan.type === 'items') {
      for (const g of plan.groups) {
        const res = await assignItemsSubcategory(g.ids, g.subcategoryId)
        if (res?.error) return setError(res.error)
      }
    } else {
      const res = await updateSubcategory(plan.id, { categoryId: plan.categoryId })
      if (res?.error) return setError(res.error)
    }
    setError(null)
  }

  function moveSelectedTo(value) {
    const target = value === UNASSIGNED ? { kind: 'unfiled', id: null } : { kind: 'sub', id: value }
    const verdict = dropVerdict({ kind: 'item', ids: [...selected] }, target, taxonomy, inventory)
    if (verdict.ok) return applyMove(verdict.move)
    if (verdict.reason) setError(verdict.reason)
  }

  const scrollRef = useRef(null)
  const { drag, begin, ghostRef, ghostStyle } = useTreeDrag({
    scrollRef,
    enabled: open && mayEdit,
    judge: (payload, target) => dropVerdict(payload, target, taxonomy, inventory),
    onDrop: (_payload, _target, verdict) => applyMove(verdict.move),
    // Held over a collapsed category, the category opens — the only way to
    // reach its subcategories without letting go.
    onDwell: (target) => {
      if (target.kind !== 'cat') return
      setCollapsed((prev) => {
        if (!prev.has(target.id)) return prev
        const next = new Set(prev)
        next.delete(target.id)
        return next
      })
    },
  })

  const itemPayload = (item) => ({
    kind: 'item',
    ids: selected.has(item.id) ? [...selected] : [item.id],
  })
  // A mouse can drag a row from anywhere on it; a finger only from the handle,
  // so the rest of the list still scrolls under a thumb.
  const rowDown = (payload) => (e) => {
    if (!mayEdit || e.pointerType !== 'mouse' || onControl(e)) return
    begin(e, payload)
  }
  const carried = drag?.payload?.kind === 'item' ? new Set(drag.payload.ids) : null
  const carriedSub = drag?.payload?.kind === 'sub' ? drag.payload.id : null
  // The place under the pointer lights up: violet where it would land, rose
  // where it is refused. Where it already is, nothing lights — nothing happens.
  const over = (kind, id = null) => {
    const t = drag?.target
    if (!t || t.kind !== kind || (t.id ?? null) !== id) return ''
    if (drag.verdict?.ok) return 'bg-violet-50 ring-2 ring-violet-300'
    if (drag.verdict?.reason) return 'bg-rose-50 ring-2 ring-rose-300'
    return ''
  }

  const toggleIn = (setter, id) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allCollapsed = tree.length > 0 && tree.every((c) => collapsed.has(c.id))

  function renderItem(item) {
    const isSel = selected.has(item.id)
    return (
      <ItemRow
        key={item.id}
        item={item}
        mayEdit={mayEdit}
        selected={isSel}
        dimmed={!!carried?.has(item.id)}
        onToggle={() => toggleIn(setSelected, item.id)}
        onRowDown={rowDown(itemPayload(item))}
        onHandleDown={(e) => begin(e, itemPayload(item))}
      />
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Inventory Hierarchy" size="lg">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {/* Creating a category is the first thing this window is for, so it is
            the first thing in it. */}
        {mayEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCategory()
                }
              }}
              placeholder="New category"
              className={`${FIELD} max-w-xs`}
            />
            <button
              type="button"
              onClick={addCategory}
              disabled={!newCat.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Plus size={14} />
              Add category
            </button>
          </div>
        )}

        {/* The order the levels nest in — the key to the tree below. */}
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Category <ChevronRight size={10} /> Subcategory <ChevronRight size={10} /> Item
          </p>
          {tree.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setCollapsed(allCollapsed ? new Set() : new Set(tree.map((c) => c.id)))
              }
              className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-violet-600 transition hover:bg-violet-50"
            >
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
          )}
        </div>

        {/* NOT FILED — the pieces with no subcategory, the ones to place first.
            Always here, so there is somewhere to drag an item OUT to. */}
        <div
          data-drop="unfiled"
          className={[
            'rounded-xl border transition',
            unfiledCount ? 'border-amber-200 bg-amber-50' : 'border-slate-200',
            over('unfiled'),
          ].join(' ')}
        >
          <button
            type="button"
            onClick={() => setUnfiledOpen((v) => !v)}
            disabled={!unfiledCount}
            aria-expanded={unfiledOpen}
            className="flex w-full items-center gap-2 px-3 py-2 text-left disabled:cursor-default"
          >
            <ChevronRight
              size={13}
              className={[
                'shrink-0 transition',
                unfiledCount ? 'text-amber-700' : 'invisible',
                unfiledOpen ? 'rotate-90' : '',
              ].join(' ')}
            />
            <Inbox size={14} className={unfiledCount ? 'text-amber-700' : 'text-slate-400'} />
            <span
              className={[
                'text-sm font-semibold',
                unfiledCount ? 'text-amber-800' : 'text-slate-700',
              ].join(' ')}
            >
              Not filed
            </span>
            <span className={['text-[11px]', unfiledCount ? 'text-amber-700' : 'text-slate-400'].join(' ')}>
              {unfiledCount ? plural(unfiledCount, 'item', 'items') : 'nothing here'}
            </span>
          </button>
          {unfiledOpen && unfiledCount > 0 && (
            <div className="space-y-2 px-3 pb-3">
              {unfiledGroups.map((g) => (
                <div key={g.former}>
                  <p className="px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    {g.former === '—' ? 'Imported with no category' : `Imported as ${g.former}`}
                  </p>
                  <div className="space-y-px">{g.items.map(renderItem)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {tree.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-slate-400">No categories yet.</p>
          )}

          {tree.map((cat) => {
            const catOpen = !collapsed.has(cat.id)
            const FolderIcon = catOpen ? FolderOpen : Folder
            return (
              <div key={cat.id} className="p-3">
                {/* The CATEGORY row — where a dragged subcategory lands. */}
                <div
                  data-drop="cat"
                  data-id={cat.id}
                  onClick={(e) => {
                    if (!onControl(e) && editing?.id !== cat.id) toggleIn(setCollapsed, cat.id)
                  }}
                  className={[
                    'flex cursor-pointer flex-wrap items-center gap-2 rounded-lg px-1 py-0.5 transition',
                    over('cat', cat.id),
                  ].join(' ')}
                >
                  {editing?.kind === 'cat' && editing.id === cat.id ? (
                    <>
                      <input
                        autoFocus
                        type="text"
                        value={editing.name}
                        onChange={(e) => setEditing((v) => ({ ...v, name: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            saveEdit()
                          }
                        }}
                        className={`${FIELD} max-w-xs`}
                      />
                      <IconBtn title="Save" onClick={saveEdit} tone="go">
                        <Check size={14} />
                      </IconBtn>
                      <IconBtn title="Cancel" onClick={() => setEditing(null)}>
                        <X size={14} />
                      </IconBtn>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleIn(setCollapsed, cat.id)}
                        aria-expanded={catOpen}
                        aria-label={catOpen ? `Collapse ${cat.name}` : `Expand ${cat.name}`}
                        className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100"
                      >
                        <ChevronRight size={14} className={catOpen ? 'rotate-90 transition' : 'transition'} />
                      </button>
                      <FolderIcon size={15} className="shrink-0 text-violet-500" />
                      <span className="text-sm font-semibold text-slate-800">{cat.name}</span>
                      <span className="text-[11px] text-slate-400">
                        {plural(cat.subs.length, 'subcategory', 'subcategories')} ·{' '}
                        {plural(cat.itemCount, 'item', 'items')}
                      </span>
                      {mayEdit && (
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            title={`Add a subcategory to ${cat.name}`}
                            onClick={() => {
                              setAdding(cat.id)
                              setAddName('')
                              if (!catOpen) toggleIn(setCollapsed, cat.id)
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-violet-600 transition hover:bg-violet-50"
                          >
                            <Plus size={12} />
                            Subcategory
                          </button>
                          <IconBtn
                            title="Rename"
                            onClick={() => setEditing({ kind: 'cat', id: cat.id, name: cat.name })}
                          >
                            <Pencil size={13} />
                          </IconBtn>
                          <RemoveBtn
                            block={categoryRemovalBlock(cat.id, taxonomy, inventory)}
                            onAsk={() => setConfirm({ kind: 'cat', id: cat.id, name: cat.name })}
                            onBlocked={setError}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Its SUBCATEGORIES — each one a place an item lands, and a
                    row that can itself be dragged to another category. */}
                {catOpen && (
                  <div className="mt-1 space-y-0.5 pl-5">
                    {cat.subs.map((sub) => {
                      const subOpen = openSubs.has(sub.id)
                      const isEditing = editing?.kind === 'sub' && editing.id === sub.id
                      const list = itemsBySub.get(sub.id) ?? []
                      return (
                        <div
                          key={sub.id}
                          data-drop="sub"
                          data-id={sub.id}
                          className={['rounded-lg transition', over('sub', sub.id)].join(' ')}
                        >
                          <div
                            onPointerDown={isEditing ? undefined : rowDown({ kind: 'sub', id: sub.id })}
                            onClick={(e) => {
                              if (!isEditing && !onControl(e)) toggleIn(setOpenSubs, sub.id)
                            }}
                            className={[
                              // One line, the name giving way first — on a phone a long
                              // name used to push its two icons onto a line of their own.
                              // Wrapping is for the rename form only.
                              'flex cursor-pointer items-center gap-1.5 rounded-lg px-1 py-0.5',
                              isEditing ? 'flex-wrap' : '',
                              carriedSub === sub.id ? 'opacity-40' : '',
                            ].join(' ')}
                          >
                            {mayEdit && !isEditing && (
                              <Handle
                                label={`Drag ${sub.name} to another category`}
                                onPointerDown={(e) => begin(e, { kind: 'sub', id: sub.id })}
                              />
                            )}
                            {isEditing ? (
                              <>
                                <input
                                  autoFocus
                                  type="text"
                                  value={editing.name}
                                  onChange={(e) => setEditing((v) => ({ ...v, name: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      saveEdit()
                                    }
                                  }}
                                  className={`${FIELD} max-w-[12rem]`}
                                />
                                {/* Moving it to another category is a real correction —
                                    and every item in it follows, because that is where
                                    their category came from. */}
                                <SelectField
                                  value={editing.categoryId}
                                  onChange={(e) =>
                                    setEditing((v) => ({ ...v, categoryId: e.target.value }))
                                  }
                                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                                  className={`${FIELD} max-w-[12rem]`}
                                />
                                <IconBtn title="Save" onClick={saveEdit} tone="go">
                                  <Check size={14} />
                                </IconBtn>
                                <IconBtn title="Cancel" onClick={() => setEditing(null)}>
                                  <X size={14} />
                                </IconBtn>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => toggleIn(setOpenSubs, sub.id)}
                                  aria-expanded={subOpen}
                                  aria-label={subOpen ? `Hide the items in ${sub.name}` : `Show the items in ${sub.name}`}
                                  className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100"
                                >
                                  <ChevronRight
                                    size={13}
                                    className={subOpen ? 'rotate-90 transition' : 'transition'}
                                  />
                                </button>
                                <span className="min-w-0 truncate text-sm text-slate-700" title={sub.name}>
                                  {sub.name}
                                </span>
                                <span className="shrink-0 text-[11px] text-slate-400">
                                  {plural(sub.itemCount, 'item', 'items')}
                                </span>
                                {mayEdit && (
                                  <div className="ml-auto flex shrink-0 items-center gap-1">
                                    <IconBtn
                                      title="Rename or move"
                                      onClick={() =>
                                        setEditing({
                                          kind: 'sub',
                                          id: sub.id,
                                          name: sub.name,
                                          categoryId: sub.categoryId,
                                        })
                                      }
                                    >
                                      <Pencil size={13} />
                                    </IconBtn>
                                    <RemoveBtn
                                      block={subcategoryRemovalBlock(sub.id, taxonomy, inventory)}
                                      onAsk={() =>
                                        setConfirm({
                                          kind: 'sub',
                                          id: sub.id,
                                          name: sub.name,
                                          note: subcategoryRemovalNote(sub.id, inventory),
                                        })
                                      }
                                      onBlocked={setError}
                                    />
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Its ITEMS */}
                          {subOpen && (
                            <div className="mb-1 ml-6 space-y-px border-l border-slate-200 pb-1 pl-2">
                              {list.length === 0 ? (
                                <p className="px-1 py-0.5 text-[11px] text-slate-400">No items yet.</p>
                              ) : (
                                list.map(renderItem)
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {adding === cat.id ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input
                          autoFocus
                          type="text"
                          value={addName}
                          onChange={(e) => setAddName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addSubcategory(cat.id)
                            }
                          }}
                          placeholder={`New subcategory in ${cat.name}`}
                          className={`${FIELD} max-w-xs`}
                        />
                        <button
                          type="button"
                          onClick={() => addSubcategory(cat.id)}
                          className="rounded-md bg-brand px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-strong"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdding(null)}
                          className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      cat.subs.length === 0 && (
                        <p className="px-1 text-[11px] text-slate-400">No subcategories yet.</p>
                      )
                    )}
                  </div>
                )}

                {confirm && confirm.kind === 'cat' && confirm.id === cat.id && (
                  <ConfirmRow
                    what={`Remove “${cat.name}”?`}
                    note="It leaves every list. Records that named it keep reading."
                    onYes={doRemove}
                    onNo={() => setConfirm(null)}
                  />
                )}
                {confirm &&
                  confirm.kind === 'sub' &&
                  cat.subs.some((x) => x.id === confirm.id) && (
                    <ConfirmRow
                      what={`Remove “${confirm.name}”?`}
                      note={confirm.note || 'It leaves every list and every picker.'}
                      onYes={doRemove}
                      onNo={() => setConfirm(null)}
                    />
                  )}
              </div>
            )
          })}
        </div>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {/* The footer carries what is IN HAND: the ticked items and where to send
          them, or the move that just happened and how to take it back. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3">
        {selected.size > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-700">
              {plural(selected.size, 'item', 'items')} selected
            </span>
            <SelectField
              value=""
              onChange={(e) => moveSelectedTo(e.target.value)}
              options={moveOptions}
              placeholder="Move to…"
              ariaLabel="Move the selected items to"
              className="w-52 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none transition"
            />
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
            >
              Clear
            </button>
          </div>
        ) : done ? (
          <p className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
            <Check size={13} className="shrink-0 text-emerald-600" />
            <span className="min-w-0 truncate" title={done.text}>
              {done.text}
            </span>
            <button
              type="button"
              onClick={undo}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 font-medium text-violet-600 transition hover:bg-violet-50"
            >
              <Undo2 size={12} />
              Undo
            </button>
          </p>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Done
        </button>
      </div>

      {/* What is being carried, under the pointer, with where it would go. */}
      {drag &&
        createPortal(
          <div
            ref={ghostRef}
            style={ghostStyle()}
            className="pointer-events-none fixed left-0 top-0 z-[90]"
          >
            <div className="max-w-[16rem] rounded-lg border border-slate-200 bg-surface px-2.5 py-1.5 shadow-xl">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                {drag.payload.kind === 'sub' ? (
                  <Folder size={12} className="shrink-0 text-violet-500" />
                ) : (
                  <Package size={12} className="shrink-0 text-slate-400" />
                )}
                <span className="truncate">{dragLabel(drag.payload, inventory, taxonomy)}</span>
              </div>
              {drag.verdict?.ok && (
                <div className="mt-0.5 truncate text-[11px] font-medium text-violet-700">
                  → {drag.verdict.move.to}
                </div>
              )}
              {drag.verdict?.reason && (
                <div className="mt-0.5 text-[11px] text-rose-600">{drag.verdict.reason}</div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </Modal>
  )
}

function ItemRow({ item, mayEdit, selected, dimmed, onToggle, onRowDown, onHandleDown }) {
  const n = itemCount(item)
  return (
    <div
      onPointerDown={onRowDown}
      onClick={(e) => {
        if (mayEdit && !onControl(e)) onToggle()
      }}
      className={[
        'flex items-center gap-1.5 rounded-md px-1 py-0.5 transition',
        selected ? 'bg-violet-50' : 'hover:bg-slate-50',
        dimmed ? 'opacity-40' : '',
        mayEdit ? 'cursor-pointer' : '',
      ].join(' ')}
    >
      {mayEdit && <Handle label={`Drag ${item.name}`} onPointerDown={onHandleDown} />}
      {mayEdit && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${item.name}`}
          className="h-3.5 w-3.5 shrink-0 accent-violet-600"
        />
      )}
      <Package size={12} className="shrink-0 text-slate-300" />
      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700" title={item.name}>
        {item.name}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
        {item.kind === 'barcoded' ? plural(n, 'unit', 'units') : `${n} on hand`}
      </span>
    </div>
  )
}

// The grip. `touch-none`, so a finger on it drags instead of scrolling the list.
function Handle({ label, onPointerDown }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onPointerDown={onPointerDown}
      className="shrink-0 cursor-grab touch-none rounded p-0.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
    >
      <GripVertical size={14} />
    </button>
  )
}

function IconBtn({ title, onClick, tone, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={[
        'rounded-md p-1 transition',
        tone === 'go'
          ? 'text-emerald-600 hover:bg-emerald-50'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// A removal that isn't allowed still CLICKS — and says what is in the way.
// Greying it out would leave the crew guessing, which is the dead end this
// codebase keeps having to undo.
function RemoveBtn({ block, onAsk, onBlocked }) {
  return (
    <button
      type="button"
      title={block || 'Remove'}
      aria-label="Remove"
      onClick={() => (block ? onBlocked(block) : onAsk())}
      className={[
        'rounded-md p-1 transition',
        block
          ? 'text-slate-300 hover:bg-slate-100'
          : 'text-slate-400 hover:bg-rose-50 hover:text-rose-500',
      ].join(' ')}
    >
      <X size={14} />
    </button>
  )
}

function ConfirmRow({ what, note, onYes, onNo }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 ring-1 ring-rose-200">
      <span className="text-xs font-medium text-rose-800">{what}</span>
      <span className="text-[11px] text-rose-600">{note}</span>
      <div className="ml-auto flex gap-1">
        <button
          type="button"
          onClick={onYes}
          className="rounded-md bg-danger px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-danger-strong"
        >
          Remove
        </button>
        <button
          type="button"
          onClick={onNo}
          className="rounded-md px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-surface"
        >
          Keep
        </button>
      </div>
    </div>
  )
}
