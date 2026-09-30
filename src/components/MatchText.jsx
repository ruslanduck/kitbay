import { highlightParts } from '../lib/search'

// A name with the words that matched the search marked — a misspelt or synonym
// match included ("profto" marks Profoto, "shot bag" marks Sandbag), which is
// exactly when seeing WHY a row is listed matters. `spans` come from
// lib/search's findMatches; without them the text is plain.
export default function MatchText({ text, spans }) {
  if (!spans?.length) return text ?? null
  return (
    <>
      {highlightParts(text, spans).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 text-slate-900">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}
