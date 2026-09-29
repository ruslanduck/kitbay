// Order status vocabulary (epic #5, 5.5).
//
// An order starts as HOLD (an estimate, yellow) and becomes CONFIRMED (green),
// which is what opens packing / scanning in epic #6. The colour lives here rather
// than inside a component because epic #7 pulls the same colour into the studio
// calendar — one definition, three consumers (list pill, detail pill, calendar).
//
// 'fulfilled' is the CLOSED state: the shoot happened and the gear came back, so
// the order stops holding stock. 'canceled' is offered too — the shoot is off,
// and like a hold it releases the gear (only 'confirmed' holds stock). 'draft'
// predates this epic (4.5 history rows use it) and stays renderable even though
// nothing sets it.
//
// `print` is the SAME pill for paper: the RGB of exactly the Tailwind colours the
// `pill` and `dot` classes name (fill = bg, ink = text, ring = ring, dot = the dot's
// bg), because jsPDF takes numbers, not classes. `npm run test:lib` derives each
// one from Tailwind's own palette and fails on drift, so the estimate and the
// packing list can never paint a status differently from the screen.
export const ORDER_STATUS = {
  hold: {
    label: 'Hold',
    pill: 'bg-amber-100 text-amber-800 ring-amber-200',
    dot: 'bg-amber-400',
    calendar: '#f59e0b',
    print: { fill: [254, 243, 198], ink: [151, 60, 0], ring: [254, 230, 133], dot: [255, 185, 0] },
  },
  confirmed: {
    label: 'Confirmed',
    pill: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    dot: 'bg-emerald-500',
    calendar: '#10b981',
    print: { fill: [208, 250, 229], ink: [0, 96, 69], ring: [164, 244, 207], dot: [0, 188, 125] },
  },
  fulfilled: {
    label: 'Closed',
    pill: 'bg-slate-100 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
    calendar: '#64748b',
    print: { fill: [241, 245, 249], ink: [69, 85, 108], ring: [226, 232, 240], dot: [144, 161, 185] },
  },
  draft: {
    label: 'Draft',
    pill: 'bg-slate-100 text-slate-500 ring-slate-200',
    dot: 'bg-slate-300',
    calendar: '#94a3b8',
    print: { fill: [241, 245, 249], ink: [98, 116, 142], ring: [226, 232, 240], dot: [202, 213, 226] },
  },
  canceled: {
    label: 'Canceled',
    pill: 'bg-rose-100 text-rose-700 ring-rose-200',
    dot: 'bg-rose-400',
    calendar: '#f43f5e',
    print: { fill: [255, 228, 230], ink: [199, 0, 54], ring: [255, 204, 211], dot: [255, 99, 126] },
  },
}

// The two states the crew toggles between while the job is still ahead of them.
export const ORDER_FLOW = ['hold', 'confirmed']

// Closing an order releases its gear; re-opening it has to ask for it back.
export const CLOSED_STATUS = 'fulfilled'
export const isClosedStatus = (status) => status === CLOSED_STATUS

export const CANCELED_STATUS = 'canceled'
export const isCanceledStatus = (status) => status === CANCELED_STATUS

// Every status a person may PICK, in the order a job travels through them. One
// list, so the card's pill dropdown and the calendar's status menu can never
// offer different sets. A legacy value ('draft') is still rendered wherever it
// is stored — it just isn't offered.
export const ORDER_STATUS_CHOICES = [...ORDER_FLOW, CLOSED_STATUS, CANCELED_STATUS]

export const orderStatusMeta = (status) => ORDER_STATUS[status] ?? ORDER_STATUS.draft

// Colour for a calendar chip driven by its order's status. Hold yellow,
// Confirmed green, Closed grey, Canceled red — the same four colours as the
// pills, from the same definition, so a chip and a pill can never disagree.
export const orderStatusColor = (status) => orderStatusMeta(status).calendar

// A shoot with no job attached has no status to colour it by (only legacy
// order-less bookings). Neutral rather than borrowed from a status it isn't in.
export const NO_STATUS_COLOR = '#94a3b8'
