// "Other" as a CHOICE, with what the other IS typed in a field beside it — the
// shoot type and the call sheet's roles.
//
// It replaced an "Other…" row that turned into a text box inside the menu and
// ADDED whatever was typed to the list for everyone: every one-off became a
// permanent option (prod's role list still offered a test "eee"). Now the list
// is fixed and a value outside it is an Other. What is STORED is still the
// typed detail ("Lookbook"), so every card, PDF and search reads it unchanged;
// a bare Other is stored as "Other".
//
// PURE — no React — so `npm run test:lib` holds the rules.
export const OTHER = 'Other'

const clean = (s) => String(s ?? '').trim()
const fold = (s) => clean(s).toLowerCase()

// The option a value IS: a fixed one in its canonical spelling ("pdp" → PDP),
// OTHER for anything else, or '' for nothing at all.
export function choiceOf(value, options = []) {
  const v = fold(value)
  if (!v) return ''
  return options.find((o) => fold(o) === v) ?? OTHER
}

// What the field beside "Other" shows: the typed detail — empty for a bare
// Other, and for a value that isn't an Other in the first place.
export function otherDetail(value, options = []) {
  if (choiceOf(value, options) !== OTHER) return ''
  return fold(value) === fold(OTHER) ? '' : clean(value)
}

// The value to STORE, the same however it was typed: a fixed option in its
// canonical spelling (a detail that names one IS that one), an Other's detail,
// a bare OTHER, or '' for nothing.
export function normalizeChoice(value, options = []) {
  const choice = choiceOf(value, options)
  if (choice !== OTHER) return choice
  return otherDetail(value, options) || OTHER
}
