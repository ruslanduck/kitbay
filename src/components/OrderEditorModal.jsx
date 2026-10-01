import { useEffect, useState } from 'react'
import { Check, Archive as ArchiveIcon, Boxes } from 'lucide-react'
import Modal from './Modal'
import ErrorNote from './ErrorNote'
import DateRangeField from './DateRangeField'
import SelectField from './SelectField'
import ComboField from './ComboField'
import AssigneesField from './AssigneesField'
import OtherSelectField from './OtherSelectField'
import { studioLabel } from '../data/studios'
import {
  ORDER_FLOW,
  ORDER_STATUS,
  ORDER_STATUS_CHOICES,
  orderStatusMeta,
} from '../data/orderStatus'
import { MAX_SET_DAYS, setSpanDays } from '../lib/setDays'
import { isValidTime } from '../lib/callTimes'
import { groupCrew, expandCrew, crewRowProblem, wrapBeforeFirstCrewCall } from '../lib/crew'
import CrewField from './CrewField'
import { JOB_TYPES, setNameApplies } from '../lib/orderSearch'
import { normalizeChoice } from '../lib/otherChoice'
import { normalizeAssignees } from '../lib/peopleOptions'

// Order (Estimate) creation form — epic #5, 5.1 + 5.2.
//
// Terminology (agreed with Clay):
//   Job   = what we shoot, a free-text job name.
//   Set   = the shoot itself; creating an order creates the Set it equips, so the
//           job shows up on the studio calendar. Max 5 sets per studio per day —
//           the store refuses the 6th and the error lands here.
//   Order = the equipment list for that set. Starts as HOLD.
//
// Creating one is TWO steps: this form settles the job (studio, set dates, job
// name, photographer, PO) and its button leads to the equipment window, which
// is where the order is actually created. Equipment used to be pickable here
// too; that duplicated the fuller picker, so it was removed.
//
// 5.2: PO number is typed in by hand — deliberately NOT generated — because it
// has to match the number accounting already issued for the job. The client
// outline said "generate automatic PO"; the last call overrode that.
//
// A shoot books WHOLE DAYS and may book several of them, so the form asks for a
// start date and an end date. It used to ask for one date plus a start and end
// TIME, and those times were fiction: the grid is studio × day, not hourly, and
// an order-created set got a hardcoded 09:00–18:00 because nothing collected
// one. The range is what the crew actually needs to say.
const blank = {
  jobName: '',
  setLabel: '',
  brand: '',
  // The studio's everyday shoot, so a new job starts there and the rare one is
  // changed. Editing never sees this — the form seeds from the record.
  jobType: 'PDP',
  notes: '',
  studioId: '1',
  location: '',
  startsOn: '',
  endsOn: '',
  crew: [],
  wrapTime: '',
  assignees: [],
  poNumber: '',
  status: 'hold',
}

export default function OrderEditorModal({
  open,
  order,
  prefill,
  studios,
  brands = [],
  onClose,
  onProceed,
  onSave,
  onDelete,
}) {
  const isEdit = !!order
  const [form, setForm] = useState(blank)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      order
        ? {
            jobName: order.jobName ?? '',
            setLabel: order.setLabel ?? '',
            brand: order.brand ?? '',
            jobType: order.jobType ?? '',
            notes: order.notes ?? '',
            studioId: order.studioId ?? '1',
            location: order.location ?? '',
            startsOn: order.startsOn ?? '',
            endsOn: order.endsOn ?? order.startsOn ?? '',
            // The call sheet lives on the SHOOT; the job form is where the crew
            // edits it, so the caller hands it in alongside the order.
            // Edited as LINES — a time, a role and everyone called for it — and
            // stored one row per person again on save (lib/crew).
            crew: groupCrew(order.crew ?? []),
            wrapTime: order.wrapTime ?? '',
            assignees: normalizeAssignees(order.assignees),
            poNumber: order.poNumber ?? '',
            status: order.status ?? 'hold',
          }
        : // 5.1 — reuse the V1 behaviour: a calendar cell pre-fills studio + date.
          { ...blank, ...(prefill ?? {}) },
    )
    setError(null)
    setConfirmDelete(false)
    setBusy(false)
  }, [open, order, prefill])

  const set = (changes) => setForm((f) => ({ ...f, ...changes }))

  // Picking a start pulls an empty or earlier end along with it, so the common
  // case (a one-day shoot) is one click and the range can never read backwards
  // just because the fields were filled in an awkward order.
  const days = setSpanDays(form.startsOn, form.endsOn)

  async function submit(e) {
    e?.preventDefault()
    if (!form.jobName.trim()) return setError('Give the shoot a name.')
    if (!form.startsOn) return setError('Pick the start date.')
    // Clamping a backwards range silently would book days nobody asked for.
    if (form.endsOn && form.endsOn < form.startsOn)
      return setError('The last day is before the first one — check the dates.')
    if (days > MAX_SET_DAYS)
      return setError(`${days} days is longer than a shoot gets (max ${MAX_SET_DAYS}) — check the year.`)
    // A row with something in it but no role, or a half-typed time, would put a
    // wrong line on the call sheet. An empty row is just a row the crew opened
    // and left — it is dropped on save.
    const rowProblem = form.crew.map(crewRowProblem).find(Boolean)
    if (rowProblem) return setError(rowProblem)
    if (form.wrapTime && !isValidTime(form.wrapTime))
      return setError('The wrap time should read as HH:MM.')
    if (wrapBeforeFirstCrewCall(form.crew, form.wrapTime))
      return setError('The wrap time is before the first call.')
    setBusy(true)
    const payload = {
      ...form,
      jobName: form.jobName.trim(),
      assignees: normalizeAssignees(form.assignees),
      // A set name belongs to a PDP day. Any other type sends it empty, which
      // clears one left over from before the type changed (the Location rule).
      setLabel: setNameApplies(normalizeChoice(form.jobType, JOB_TYPES)) ? form.setLabel.trim() : '',
      brand: form.brand.trim(),
      // "pdp" typed beside Other IS PDP; anything else is stored as typed.
      jobType: normalizeChoice(form.jobType, JOB_TYPES),
      notes: form.notes.trim(),
      // Written only while the job is on L; any other studio sends it empty,
      // which clears an address left over from before a move.
      location: form.studioId === 'L' ? (form.location ?? '').trim() : '',
      // A one-day shoot ends the day it starts; the store normalises this too,
      // so nothing downstream has to guess what an empty end means.
      endsOn: form.endsOn || form.startsOn,
      crew: expandCrew(form.crew),
      wrapTime: form.wrapTime || null,
    }
    // Creating is a two-step flow: this form settles the job, then the equipment
    // window opens and IT creates the order together with the gear. So nothing is
    // written yet — abandoning step two leaves no empty order behind.
    const res = isEdit ? await onSave(order.id, payload) : await onProceed(payload)
    setBusy(false)
    if (res?.error) return setError(res.error)
    onClose()
  }

  // A NEW job can only be somewhere ahead of you, and it starts on Hold — the
  // segment is lit from the form's own default, so the state is shown rather
  // than explained. An EXISTING job offers every state it can be moved to, plus
  // its own when that is a legacy value ('draft'): a control that cannot show
  // where you already are reads as broken, which is exactly what the note it
  // replaces was apologising for. Same list as the card's pill and the
  // calendar's status menu.
  const statusChoices = !isEdit
    ? ORDER_FLOW
    : ORDER_STATUS_CHOICES.includes(form.status)
      ? ORDER_STATUS_CHOICES
      : [form.status, ...ORDER_STATUS_CHOICES]

  const label = 'mb-1.5 block text-sm font-medium text-slate-700'
  const field =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100'

  return (
    <Modal open={open} onClose={onClose} size="lg" title={isEdit ? 'Edit job' : 'New job'}>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={setNameApplies(form.jobType) ? 'sm:col-span-2' : 'sm:col-span-3'}>
              <label className={label}>Shoot name</label>
              <input
                autoFocus
                type="text"
                value={form.jobName}
                onChange={(e) => set({ jobName: e.target.value })}
                placeholder="e.g. Loft e-commerce on figure"
                className={field}
              />
            </div>
            {/* The crew's own designation for the set — typed, never generated,
                like the PO. A PDP day runs several sets and this is what tells
                them apart on the calendar and on the packing list; an editorial
                shoot has none, so the field is there only for PDP — and for a
                job with no type yet, which is where every job predating shoot
                types sits (hiding theirs would lose it on the next save). */}
            {setNameApplies(form.jobType) && (
              <div>
                <label className={label}>Set name</label>
                <input
                  type="text"
                  value={form.setLabel}
                  onChange={(e) => set({ setLabel: e.target.value })}
                  placeholder="e.g. OMSet1"
                  className={field}
                />
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Location / Studio</label>
              <SelectField
                value={form.studioId}
                onChange={(e) => set({ studioId: e.target.value })}
                options={studios.map((id) => ({ value: id, label: studioLabel(id) }))}
                className={field}
              />
            </div>
            {/* A shoot books whole days, from the first to the last — no times.
                Availability, the estimate's billable days, the packing list and
                the job search all read this window. */}
            <div>
              <label className={label}>Shoot dates</label>
              <DateRangeField
                from={form.startsOn}
                to={form.endsOn}
                onChange={({ from, to }) => set({ startsOn: from, endsOn: to })}
                className={field}
              />
            </div>
          </div>

          {form.studioId === 'L' && (
            <div>
              <label className={label}>Address</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => set({ location: e.target.value })}
                placeholder="e.g. Pier 59 / Studio 101, Chelsea Piers, New York"
                className={field}
              />
            </div>
          )}

          {/* The job's ASSIGNEES — where the photographer was: the whole crew,
              anyone in People, each with their role on this job ("имя (роль)").
              Not call-sheet lines: the sheet says who is called WHEN, this says
              who is on the job. A name People doesn't have is added there on
              save. Full width, because every person is a row with a role. */}
          <div>
            <label className={label}>Assignees</label>
            <AssigneesField
              value={form.assignees}
              // An updater, applied against the CURRENT form — two picks in a
              // row would otherwise both start from the same list.
              onChange={(fn) => setForm((f) => ({ ...f, assignees: fn(f.assignees) }))}
            />
          </div>

          {/* The call sheet. A shoot has no single start time — the
              photographer is called at 08:00 and the models at 10:00 — so the
              generic start/end pair was replaced by this list plus a wrap.
              ⚠️ A call sheet belongs to the SHOOT (`roster_entries` +
              `sets.wrap_time`), so a job with no shoot row has nowhere to keep
              one. Three legacy sub-rental orders are in that state — we rented
              FROM a vendor, no studio was booked — and the form used to take a
              full call sheet and drop it on save without a word. Measured on
              prod: typed 07:15 Producer + Photographer with an 18:30 wrap,
              saved, and the card came back "not set". Creating a job is fine —
              its shoot is written in the same action. */}
          {isEdit && !order?.setId ? (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 ring-1 ring-slate-200">
              <p className="font-medium text-slate-700">No call sheet</p>
              <p className="mt-1">This job has no shoot booked.</p>
            </div>
          ) : (
            <div className="rounded-lg bg-surface p-3 ring-1 ring-slate-200">
              <CrewField
                value={form.crew}
                // The field hands back an updater, applied against the CURRENT
                // form — see the note on CrewField.
                onChange={(fn) => setForm((f) => ({ ...f, crew: fn(f.crew) }))}
                wrapTime={form.wrapTime}
                onWrapChange={(wrapTime) => set({ wrapTime })}
              />
            </div>
          )}

          {/* Brand + shoot type (20260908120000). Brand is free text with
              suggestions. The shoot type is Editorial / PDP / Other, with what
              the other IS typed beside it — asked for: the old "Other…" row added
              every typed type to the list for everyone, so a one-off "Test"
              became a permanent option. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Brand</label>
              <ComboField
                value={form.brand}
                onChange={(e) => set({ brand: e.target.value })}
                options={brands}
                placeholder="Who is it for…"
                className={field}
              />
            </div>
            <div>
              <label className={label}>Shoot type</label>
              <OtherSelectField
                value={form.jobType}
                onChange={(e) => set({ jobType: e.target.value })}
                options={JOB_TYPES}
                placeholder="Pick a shoot type"
                ariaLabel="Shoot type"
                detailPlaceholder="Which shoot type?"
                detailAriaLabel="Which shoot type"
                selectClassName={field}
                detailClassName={field}
              />
            </div>
          </div>

          {/* A free-text note on the JOB. Deliberately a textarea, not an input:
              what the crew writes here is a sentence or three ("client brings
              their own backdrop", "load in through the freight door"), and a
              single-line box would hide most of it. */}
          <div>
            <label className={label}>Note</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Additional details"
              className={`${field} resize-y`}
            />
          </div>

          {/* 5.2 — the accounting PO, typed in by hand */}
          <div>
            <label className={label}>PO number</label>
            <input
              type="text"
              value={form.poNumber}
              onChange={(e) => set({ poNumber: e.target.value })}
              placeholder="e.g. PO-4503"
              className={[field, 'font-mono'].join(' ')}
            />
          </div>

          <div>
            <label className={label}>Status</label>
            <div className="flex rounded-lg border border-slate-300 p-0.5">
              {statusChoices.map((value) => {
                const meta = orderStatusMeta(value)
                const on = form.status === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set({ status: value })}
                    className={[
                      'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition',
                      on ? [meta.pill, 'ring-1'].join(' ') : 'text-slate-600 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    {ORDER_STATUS[value]?.label ?? value}
                  </button>
                )
              })}
            </div>
          </div>

        </div>

        <ErrorNote>{error}</ErrorNote>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
          {isEdit && onDelete ? (
            confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">
                  Archive this job? Its equipment is released and the shoot leaves the calendar.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(order.id)
                    onClose()
                  }}
                  className="rounded-md bg-danger px-2.5 py-1 font-medium text-white transition hover:bg-danger-strong"
                >
                  Archive
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md px-2 py-1 font-medium text-slate-500 transition hover:bg-slate-100"
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
              >
                <ArchiveIcon size={15} />
                Archive
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
            >
              {isEdit ? <Check size={15} /> : <Boxes size={15} />}
              {isEdit ? 'Save job' : 'Select equipment'}
            </button>
          </div>
        </div>
      </form>

    </Modal>
  )
}
