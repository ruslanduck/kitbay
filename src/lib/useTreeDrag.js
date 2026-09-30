import { useEffect, useMemo, useRef, useState } from 'react'

// Pointer-driven drag & drop for a tree inside a scrolling panel — the
// Inventory Hierarchy, where items move between subcategories and a
// subcategory moves between categories.
//
// Why not the HTML5 drag & drop API: it does not work with a finger on most
// phones and tablets, and this app is used on iPads and iPhones. Pointer events
// are one path for mouse, pen and touch alike (the handle carries
// `touch-action: none`, so a finger on it drags instead of scrolling).
//
// What the hook owns, so the window only renders:
//   • a press becomes a drag only after the pointer MOVES a few pixels, so a tap
//     is still a tap;
//   • the place under the pointer is the nearest `[data-drop]` ancestor of
//     `elementFromPoint` — `data-drop` is the kind, `data-id` the row — and the
//     caller's `judge` turns it into a verdict, re-asked only when it changes;
//   • the panel scrolls itself while the pointer is near its top or bottom edge,
//     so a long tree can be crossed in one drag;
//   • a place held for a moment is reported (`onDwell`) — a collapsed category
//     opens under the pointer, the way a folder does;
//   • Escape cancels without closing the window behind it, and the click the
//     browser fires after a drag is swallowed so a drop doesn't also toggle
//     whatever it landed on.
//
// A hook, so it lives in lib/ with the others (exporting one beside a component
// breaks fast refresh).

const START_AFTER = 4 // px of movement before a press becomes a drag
const EDGE = 44 // px from the panel's edge where it starts scrolling
const MAX_STEP = 16 // px per frame at the very edge
const DWELL = 550 // ms on one place before it counts as held

// The place an element belongs to: { kind, id } of its nearest [data-drop].
export function dropTargetOf(el) {
  const t = el?.closest?.('[data-drop]')
  if (!t) return null
  return { kind: t.dataset.drop, id: t.dataset.id ?? null }
}

export function useTreeDrag({ scrollRef, judge, onDrop, onDwell, enabled = true }) {
  // What renders: the payload, the place under the pointer and its verdict.
  // It changes only when the PLACE changes — the ghost follows the pointer by
  // writing its transform directly, not by re-rendering the tree 60× a second.
  const [drag, setDrag] = useState(null)
  const ghostRef = useRef(null)
  const live = useRef(null)
  // The caller's callbacks close over the latest tree; kept in a ref so the
  // window listeners below are attached once, not on every render.
  const cbs = useRef({ judge, onDrop, onDwell })
  useEffect(() => {
    cbs.current = { judge, onDrop, onDwell }
  })

  const api = useMemo(() => {
    const place = () => {
      const d = live.current
      const g = ghostRef.current
      if (d && g) g.style.transform = `translate(${d.x + 14}px, ${d.y + 12}px)`
    }

    const retarget = () => {
      const d = live.current
      if (!d?.started) return
      const t = dropTargetOf(document.elementFromPoint(d.x, d.y))
      const k = t ? `${t.kind}:${t.id ?? ''}` : ''
      if (k === d.key) return
      d.key = k
      clearTimeout(d.dwell)
      d.target = t
      d.verdict = t ? cbs.current.judge?.(d.payload, t) ?? null : null
      setDrag({ payload: d.payload, target: t, verdict: d.verdict })
      if (t)
        d.dwell = setTimeout(() => {
          if (live.current === d && d.key === k) cbs.current.onDwell?.(t, d.payload)
        }, DWELL)
    }

    // Every frame while dragging: scroll near an edge, and re-read the place
    // under the pointer — the content moves under a still pointer when the
    // panel scrolls or a category opens, and that has to count as a move.
    const tick = () => {
      const d = live.current
      if (!d?.started) return
      const box = scrollRef?.current
      if (box) {
        const r = box.getBoundingClientRect()
        let step = 0
        if (d.y < r.top + EDGE) step = -Math.min(MAX_STEP, Math.ceil(((r.top + EDGE - d.y) / EDGE) * MAX_STEP))
        else if (d.y > r.bottom - EDGE)
          step = Math.min(MAX_STEP, Math.ceil(((d.y - (r.bottom - EDGE)) / EDGE) * MAX_STEP))
        if (step) box.scrollTop += step
      }
      retarget()
      d.raf = requestAnimationFrame(tick)
    }

    const finish = () => {
      const d = live.current
      if (!d) return
      cancelAnimationFrame(d.raf)
      clearTimeout(d.dwell)
      live.current = null
      document.body.classList.remove('tree-dragging')
      setDrag(null)
    }

    // The click that follows a drag lands on whatever was under the pointer.
    const swallowNextClick = () => {
      const stop = (ev) => {
        ev.stopPropagation()
        ev.preventDefault()
        window.removeEventListener('click', stop, true)
      }
      window.addEventListener('click', stop, true)
      setTimeout(() => window.removeEventListener('click', stop, true), 0)
    }

    const begin = (e, payload) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      // No text selection trailing the pointer, and a handle inside a row
      // doesn't also start the row's own drag.
      e.preventDefault()
      e.stopPropagation()
      finish()
      live.current = {
        payload,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        started: false,
        key: null,
        target: null,
        verdict: null,
      }
      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId)
      } catch {
        // A pointer the browser doesn't know (a synthetic one) can't be
        // captured; the window listeners still see it.
      }
    }

    const onMove = (e) => {
      const d = live.current
      if (!d || e.pointerId !== d.pointerId) return
      d.x = e.clientX
      d.y = e.clientY
      if (!d.started) {
        if (Math.hypot(d.x - d.startX, d.y - d.startY) < START_AFTER) return
        d.started = true
        document.body.classList.add('tree-dragging')
        setDrag({ payload: d.payload, target: null, verdict: null })
        d.raf = requestAnimationFrame(tick)
      }
      place()
    }

    const onUp = (e) => {
      const d = live.current
      if (!d || e.pointerId !== d.pointerId) return
      if (!d.started) return finish()
      d.x = e.clientX
      d.y = e.clientY
      // Decide on where the pointer was LET GO, not on the last frame.
      retarget()
      const { payload, target, verdict } = d
      swallowNextClick()
      finish()
      if (target && verdict?.ok) cbs.current.onDrop?.(payload, target, verdict)
    }

    const onKey = (e) => {
      if (e.key !== 'Escape' || !live.current?.started) return
      // Capture phase on window runs first, so this also keeps the modal's own
      // Escape from closing the window mid-drag.
      e.preventDefault()
      e.stopPropagation()
      finish()
    }

    return { begin, finish, onMove, onUp, onKey, place }
  }, [scrollRef])

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('pointermove', api.onMove)
    window.addEventListener('pointerup', api.onUp)
    window.addEventListener('pointercancel', api.finish)
    window.addEventListener('keydown', api.onKey, true)
    return () => {
      window.removeEventListener('pointermove', api.onMove)
      window.removeEventListener('pointerup', api.onUp)
      window.removeEventListener('pointercancel', api.finish)
      window.removeEventListener('keydown', api.onKey, true)
      api.finish()
    }
  }, [enabled, api])

  // Where the ghost starts on the render that mounts it; after that `place`
  // moves it directly.
  const ghostStyle = () => {
    const d = live.current
    return d ? { transform: `translate(${d.x + 14}px, ${d.y + 12}px)` } : { display: 'none' }
  }

  return { drag, begin: api.begin, ghostRef, ghostStyle }
}
