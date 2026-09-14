import { useEffect } from 'react'
import { useStore } from '../store'
import { pathForView, viewForPath } from './routes'

// Keeps the address bar and `activeView` in step, in BOTH directions.
//
// The whole difficulty is push vs replace. Wrong one way and the back arrow
// needs two presses to undo one step; wrong the other way and it SKIPS the
// screen you came from. Two facts decide it, and both are OBSERVABLE at the
// moment the view changes rather than remembered in a flag:
//
//   • the address ALREADY matches the new screen — then the browser is what
//     moved us (back / forward), or the push carried the address with it. The
//     entry exists; only its stamp may need writing. REPLACE.
//   • the current entry carries no stamp — a fresh load, or an entry somebody
//     else just pushed (a drill-in's `pushNav`). REPLACE, and stamp it. This
//     is also what turns "/" or an unknown path into the real screen's address.
//   • it is stamped with ANOTHER screen and the address still points there —
//     a navigation that pushed nothing ("Open full view" on a peek card, a
//     drill-in raised without a `from`). PUSH, or the back arrow jumps clean
//     past the screen the person came from.
//
// An earlier version tracked "did the browser move us" in a ref. It leaked:
// a popstate that changed nothing left the flag set, and the NEXT navigation
// silently replaced instead of pushing. A fact you can read beats a flag you
// have to remember to clear.
export function useRouteSync() {
  const activeView = useStore((s) => s.activeView)

  useEffect(() => {
    const onPop = () => {
      const s = useStore.getState()
      // A drill-in pushed this entry and remembers what was selected there, so
      // it owns the step back.
      if (s.navStack.length) {
        s.goBack()
        return
      }
      const view = viewForPath(window.location.pathname)
      if (view) s.applyRouteView(view)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const want = pathForView(activeView)
    const here = window.location.pathname
    const current = window.history.state || {}
    if (current.view === activeView && here === want) return

    const state = { ...current, view: activeView }
    const url = want + window.location.search + window.location.hash
    const owned = here === want || current.view === undefined || current.view === activeView
    if (owned) window.history.replaceState(state, '', url)
    else window.history.pushState(state, '', url)
  }, [activeView])
}
