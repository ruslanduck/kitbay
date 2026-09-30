// Flexible search for the inventory register: the words a crew actually types
// find the gear — in any order, part-typed, misspelt, or said another way.
//
// It replaced `name.toLowerCase().includes(query)` in every picker, which only
// found an item when the query was ONE unbroken piece of its stored name:
// "fresnel profoto", "c stand", "12x12 silk" or "profto" found nothing.
//
// What a query goes through:
//   1. NORMALISED, the same way as the names: case and accents off; a size
//      written 6×6, 6x6 or 6' x 6' is one term (6x6); 2" is "2 in", 25' is
//      "25 ft", 5° is "5 degree"; a name's neighbouring words also yield the
//      joined word (C-Stand → cstand, Speed Rail → speedrail) and a word mixing
//      letters and digits its parts (B10X → b, 10, x) — so either way of
//      writing it finds the other.
//   2. SYNONYMS (data/searchSynonyms): a query word or phrase in a group also
//      matches the group's other entries — "mic" finds a Microphone, "century
//      stand" a C-Stand, "shot bag" a Sandbag, "quarter" a 1/4.
//   3. MATCHED — every term, in any order (AND), against the item's name,
//      brand, subcategory, category, unit barcodes and serials, and note: the
//      whole word, then the start of a word (live results while typing:
//      "fres" → Fresnel), then inside a word (3+ letters), then within typo
//      distance (one edit from 4 letters, two from 8; a swapped pair is one;
//      the first letter must be right).
//      A plural is the same word ("stands" = stand, "lenses" = lens).
//   4. RANKED — the score adds up how well each term matched, weighted by where
//      (the name counts most), plus small bonuses for a name that starts with
//      the first word, holds every word, and holds them in the order typed.
//
// Rules that keep it from being noisy, each found by running it against the
// studio's real 276-item register:
//   • numbers and codes are never matched fuzzily — 0852 must not find barcode
//     0851 — and a number only matches as the START of another number ("12" →
//     120) while it is the word still being typed; "2 inch" means 2";
//   • a single letter matches only a whole word of the NAME ("usb c", "a
//     clamp"), or the start of one while it is being typed ("profoto b" on its
//     way to Beauty) — "c" is not the start of the category "Camera Support";
//   • inside-a-word matching reads real words only, not the joined forms —
//     "cstand" is not inside "magiCSTAND";
//   • a typo keeps its first letter — "mark" is not "cark", and "cstand" is
//     not "stand" with one letter deleted;
//   • a four-letter word is forgiven a typo only when it matches nothing as
//     typed — "grid" must not also bring every item filed under "Grip".
//
// Speed: every distinct term of the register is scored against each query word
// ONCE (the register has far fewer distinct words than words), and items only
// look those scores up — a keystroke stays in single-digit milliseconds.
//
// PURE — no React, no store, no DOM — so `npm run test:lib` pins the behaviour.

import { SEARCH_SYNONYMS } from '../data/searchSynonyms.js'
import { categoryById, subcategoryById } from './taxonomy.js'

// ---------------------------------------------------------------------------
// Normalising

export function fold(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// A number (with its decimal or fraction: 2.8, 1/4) or a run of letters.
const PIECE = /\d+(?:[.,]\d+|\/\d+)?|\p{L}+/gu
// A word as written — letters and digits together (B10X, 100mm, CG279X).
const WORD = /[\p{L}\p{N}]+/gu
// A size: 6×6, 6x6, 12' x 12', 24" x 36", 59×14×17" — marks included, so the
// whole thing lights up.
const SIZE =
  /(\d+(?:\.\d+)?)\s*["'”’″′]?\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*["'”’″′]?\s*[x×]\s*(\d+(?:\.\d+)?))?(?:\s*["'”’″′])?/giu
const HAS_DIGIT = /\d/
const HAS_LETTER = /\p{L}/u

// Words that carry no meaning of their own in a query ("usb c to usb c"). They
// are dropped unless they are all there is.
const STOP = new Set(['and', 'the', 'of', 'for', 'with', 'to'])

// Plural and singular are the same word — without a stemmer that would turn
// "lens" into "len": the shorter one plus s / es, or y ↔ ies.
export function sameWord(a, b) {
  if (a === b) return true
  const [s, l] = a.length <= b.length ? [a, b] : [b, a]
  if (s.length < 3 || HAS_DIGIT.test(s)) return false
  if (l === `${s}s` || l === `${s}es`) return true
  return s.endsWith('y') && l === `${s.slice(0, -1)}ies`
}

// Damerau–Levenshtein (optimal string alignment): insertions, deletions,
// substitutions and a swapped neighbouring pair each cost one. Gives up past
// `max`, which is all the caller needs to know.
export function editDistance(a, b, max = 2) {
  if (a === b) return 0
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > max) return max + 1
  let prev2 = null
  let prev = Array.from({ length: lb + 1 }, (_, j) => j)
  for (let i = 1; i <= la; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, prev2[j - 2] + 1)
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev2 = prev
    prev = cur
  }
  return prev[lb]
}

// How many typos a word of this length may carry — the thresholds search
// engines settle on (one from four letters, two from eight). Three letters and
// under get none: a three-letter word one edit away is a different word.
export const maxEdits = (len) => (len < 4 ? 0 : len < 8 ? 1 : 2)

// ---------------------------------------------------------------------------
// The searchable terms of a text, each pointing at where it sits in the
// ORIGINAL string so a match can be highlighted there. `kind` is what the term
// is: word, num, mixed (b10x), join (cstand), size (6x6), unit (in/ft), code.

export function termsOf(text, { code = false } = {}) {
  const src = String(text ?? '')
  const out = []
  if (!src.trim()) return out
  const push = (term, start, end, kind) => {
    if (term) out.push({ term, start, end, kind })
  }
  // A barcode or serial is one code: its whole, its start or (long) a piece.
  if (code) {
    push(fold(src).replace(/[^\p{L}\p{N}]/gu, ''), 0, src.length, 'code')
    return out
  }
  const pieces = [...src.matchAll(PIECE)].map((m) => ({
    t: fold(m[0]).replace(',', '.'),
    start: m.index,
    end: m.index + m[0].length,
  }))
  for (const p of pieces) push(p.t, p.start, p.end, HAS_DIGIT.test(p.t) ? 'num' : 'word')
  for (const m of src.matchAll(WORD)) {
    const w = fold(m[0])
    if (HAS_DIGIT.test(w) && HAS_LETTER.test(w)) push(w, m.index, m.index + m[0].length, 'mixed')
  }
  // Neighbours joined, across a space or a hyphen only: cstand, speedrail,
  // applebox, usbc, markiv. Two numbers are never joined ("24-70" is not 2470).
  for (let i = 0; i + 1 < pieces.length; i++) {
    const a = pieces[i]
    const b = pieces[i + 1]
    if (!/^[\s\-–]*$/.test(src.slice(a.end, b.start))) continue
    if (HAS_DIGIT.test(a.t) && HAS_DIGIT.test(b.t)) continue
    push(a.t + b.t, a.start, b.end, 'join')
  }
  for (const m of src.matchAll(SIZE))
    push([m[1], m[2], m[3]].filter(Boolean).join('x'), m.index, m.index + m[0].length, 'size')
  for (const m of src.matchAll(/\d\s*(["”″]|['’′]|°)/gu)) {
    const unit = /["”″]/.test(m[1]) ? 'in' : m[1] === '°' ? 'degree' : 'ft'
    push(unit, m.index + m[0].length - 1, m.index + m[0].length, 'unit')
  }
  for (const m of src.matchAll(/&/g)) push('and', m.index, m.index + 1, 'word')
  return out
}

// ---------------------------------------------------------------------------
// Reading a query

const IS_SIZE = /^\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?){1,2}$/

// The query's words, normalised like a name: sizes collapsed to one term, unit
// marks spelled out, hyphenated letters joined ("c-stand" → cstand).
export function queryWords(query) {
  const src = fold(query)
    .replace(SIZE, (_m, a, b, c) => ` ${[a, b, c].filter(Boolean).join('x')} `)
    .replace(/(\d)\s*["”″]/g, '$1 in ')
    .replace(/(\d)\s*['’′]/g, '$1 ft ')
    .replace(/°/g, ' degree ')
    .replace(/&/g, ' and ')
    .replace(/(\p{L})[-–](?=\p{L})/gu, '$1')
  const words = []
  for (const raw of src.split(/\s+/)) {
    const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    if (!w) continue
    if (IS_SIZE.test(w)) {
      words.push({ text: w, pieces: [w] })
      continue
    }
    const pieces = (w.match(PIECE) || []).map((p) => p.replace(',', '.'))
    if (!pieces.length) continue
    words.push({ text: w.replace(/[^\p{L}\p{N}./]/gu, ''), pieces })
  }
  return words
}

// Each synonym entry, parsed exactly like a query, keyed by its words.
function synonymTable(groups) {
  const byKey = new Map()
  const single = [] // one-word entries, for the word still being typed
  const entries = groups.map((group) =>
    group.map((entry) => queryWords(entry).flatMap((w) => w.pieces)).filter((w) => w.length),
  )
  entries.forEach((list, g) => {
    for (const words of list) {
      const key = words.join(' ')
      if (!byKey.has(key)) byKey.set(key, new Set())
      byKey.get(key).add(g)
      if (words.length === 1) single.push({ key, g })
    }
  })
  return { byKey, single, entries }
}

const TABLE_CACHE = new WeakMap()
function tableFor(groups) {
  if (!TABLE_CACHE.has(groups)) TABLE_CACHE.set(groups, synonymTable(groups))
  return TABLE_CACHE.get(groups)
}

// The query as TERMS, each with its alternatives: its own words (weight 1) and
// what its synonyms say (weight 0.9; 0.8 for a word still being typed). A
// phrase of up to three words can be one term ("century stand"). The LAST word
// of the last term's own alternative is `openAt`: that is the word still being
// typed — in "b10" it is the 10, not the b.
export function parseQuery(query, { synonyms = SEARCH_SYNONYMS } = {}) {
  let words = queryWords(query)
  const meaningful = words.filter((w) => !STOP.has(w.text))
  if (meaningful.length) words = meaningful
  const table = tableFor(synonyms)
  const terms = []
  for (let i = 0; i < words.length; ) {
    let taken = 0
    for (let n = Math.min(3, words.length - i); n >= 1 && !taken; n--) {
      const slice = words.slice(i, i + n)
      const own = slice.flatMap((w) => w.pieces)
      const groups = table.byKey.get(own.join(' ')) || table.byKey.get(slice.map((w) => w.text).join(' '))
      if (!groups) continue
      const alts = [{ words: own, weight: 1, own: true }]
      for (const g of groups)
        for (const entry of table.entries[g])
          if (entry.join(' ') !== own.join(' ')) alts.push({ words: entry, weight: 0.9 })
      terms.push({ text: slice.map((w) => w.text).join(' '), alts })
      taken = n
    }
    if (taken) {
      i += taken
      continue
    }
    const w = words[i]
    const alts = [{ words: w.pieces.length > 1 ? [w.text] : w.pieces, weight: 1, own: true }]
    if (w.pieces.length > 1) alts.push({ words: w.pieces, weight: 1, own: true })
    // The last word is usually still being typed: "shotb" already reaches the
    // sandbag group through "shotbag".
    if (i === words.length - 1 && w.text.length >= 3 && !HAS_DIGIT.test(w.text)) {
      const seen = new Set()
      for (const s of table.single)
        if (s.key !== w.text && s.key.startsWith(w.text) && !seen.has(s.g)) {
          seen.add(s.g)
          for (const entry of table.entries[s.g]) alts.push({ words: entry, weight: 0.8 })
        }
    }
    terms.push({ text: w.text, alts })
    i += 1
  }
  const last = terms[terms.length - 1]
  if (last) for (const alt of last.alts) if (alt.own) alt.openAt = alt.words.length - 1
  return terms
}

// ---------------------------------------------------------------------------
// Matching

// How well one query word matches one term, 0 to 100. `open`: the word is the
// one still being typed. `strict`: the word came from a SYNONYM, not from the
// user — no typo tolerance on top of it, or the expansion compounds ("cstand"
// is one edit from "stand").
function wordScore(w, t, open, strict, fuzzy = true) {
  const x = t.term
  const code = t.kind === 'code'
  if (x === w) return 100
  if (w.length === 1) return open && !code && x.startsWith(w) ? 60 : 0
  if (!code && sameWord(w, x)) return 100
  const numeric = code || HAS_DIGIT.test(w) || HAS_DIGIT.test(x)
  if (x.startsWith(w)) {
    if (code) return w.length >= 2 ? 85 : 0
    if (numeric) return open ? 45 : 0 // "12" is the start of 120 only mid-typing
    return 82
  }
  if (code) return w.length >= 5 && x.includes(w) ? 70 : 0
  if (numeric) return 0
  // Inside a word only where words are compounds of each other — a NAME
  // ("boom" in Megaboom, "bank" in Lightbank) — not in a subcategory, where
  // "head" inside "OVERHEAD Fabrics" would bring every silk.
  if (w.length >= 3 && t.kind === 'word' && t.parts && x.includes(w)) return 55
  const e = maxEdits(w.length)
  // A typo keeps its first letter — the usual rule for fuzzy search, and the
  // one that keeps a deleted first letter from turning one word into another.
  if (strict || !fuzzy || !e || t.kind === 'unit' || x[0] !== w[0]) return 0
  const d = editDistance(w, x, e)
  if (d <= e) return 64 - 14 * d
  // A typo in a word that is still being typed: "prfoo" against "profoto".
  // Not for a four-letter start — "mats" would be a typo of every "Matt…".
  if (open && w.length >= 5 && x.length > w.length) {
    const dp = Math.min(
      editDistance(w, x.slice(0, w.length), e),
      editDistance(w, x.slice(0, w.length + 1), e),
    )
    if (dp <= e) return 46 - 14 * dp
  }
  return 0
}

// ---------------------------------------------------------------------------
// The index and the search

// What an item is searched by: [{ weight, text, code?, name?, parts? }] —
// `name` marks the field whose matches are highlighted (and implies `parts`:
// a query may match inside one of its words).
export function describeItem(taxonomy = null) {
  return (item) => {
    const sub = taxonomy && item.subcategoryId ? subcategoryById(taxonomy, item.subcategoryId) : null
    const cat = sub ? categoryById(taxonomy, sub.categoryId) : null
    const units = (item.units || []).filter((u) => !u.archivedAt)
    return [
      { weight: 1, text: item.name, name: true },
      { weight: 0.85, text: item.brand, parts: true },
      { weight: 0.7, text: sub?.name },
      { weight: 0.6, text: cat?.name },
      ...units.flatMap((u) => [
        { weight: 0.95, text: u.barcode, code: true },
        { weight: 0.9, text: u.serial, code: true },
      ]),
      { weight: 0.35, text: item.notes },
    ]
  }
}

export const describeByName = (row) => [{ weight: 1, text: row.name, name: true }]

// The register, indexed once: every distinct term in a dictionary, each row's
// fields pointing into it. Rebuilt only when the rows change.
export function buildIndex(rows, describe = describeByName) {
  const dict = new Map() // `${kind}|${parts}|${term}` → id
  const terms = [] // id → { term, kind, parts }
  const idOf = (t, parts) => {
    const key = `${t.kind}|${parts ? 1 : 0}|${t.term}`
    let id = dict.get(key)
    if (id === undefined) {
      id = terms.length
      dict.set(key, id)
      terms.push({ term: t.term, kind: t.kind, parts })
    }
    return id
  }
  const entries = (rows ?? []).map((row) => {
    const described = describe(row)
    const fields = described
      .filter((f) => f.text != null && String(f.text).trim())
      .map((f) => ({
        weight: f.weight,
        name: !!f.name,
        refs: termsOf(f.text, { code: f.code }).map((t) => ({
          id: idOf(t, !!(f.name || f.parts)),
          start: t.start,
          end: t.end,
          kind: t.kind,
        })),
      }))
    const nameField = fields.find((f) => f.name)
    return {
      row,
      fields,
      name: String(described.find((f) => f.name)?.text ?? ''),
      namePieces: nameField ? nameField.refs.filter((r) => r.kind === 'word' || r.kind === 'num').length : 0,
    }
  })
  return { terms, entries }
}

// Every row that matches EVERY term, best first: [{ row, score, spans }] —
// `spans` are [start, end] pairs in the name to highlight. An empty query
// returns the rows as they are.
export function findMatches(index, query, { synonyms = SEARCH_SYNONYMS, limit = Infinity } = {}) {
  const entries = index?.entries ?? []
  const terms = parseQuery(query, { synonyms })
  if (!terms.length) return entries.slice(0, limit).map((e) => ({ row: e.row, score: 0, spans: [] }))

  // Score each distinct query word against each distinct term, once.
  const table = new Map() // flags|word → Float32Array over index.terms
  const scoresFor = (w, open, strict) => {
    const key = `${open ? 1 : 0}${strict ? 1 : 0}|${w}`
    let s = table.get(key)
    if (!s) {
      const n = index.terms.length
      s = new Float32Array(n)
      let found = 0
      for (let i = 0; i < n; i++) {
        s[i] = wordScore(w, index.terms[i], open, strict, false)
        if (s[i] > found) found = s[i]
      }
      // Typos are forgiven for a long word always, and for a four-letter one
      // only when it matches nothing as typed: "grid" is a real word here and
      // must not also bring every item in "Grip", while "magc" still finds
      // Magic.
      if (!strict && (w.length >= 5 || found < 82))
        for (let i = 0; i < n; i++) if (!s[i]) s[i] = wordScore(w, index.terms[i], open, strict, true)
      table.set(key, s)
    }
    return s
  }
  for (const term of terms)
    for (const alt of term.alts) {
      alt.scores = alt.words.map((w, j) => scoresFor(w, alt.openAt === j, !alt.own))
      alt.single = alt.words.map((w) => w.length === 1)
    }

  const out = []
  for (const entry of entries) {
    let total = 0
    const spans = []
    let inName = 0
    let firstAtStart = false
    let lastStart = -1
    let inOrder = true
    let ok = true
    for (let k = 0; k < terms.length; k++) {
      let best = null
      for (const alt of terms[k].alts) {
        let sum = 0
        const hits = []
        for (let j = 0; j < alt.words.length; j++) {
          const scores = alt.scores[j]
          let top = 0
          let hit = null
          for (const field of entry.fields) {
            if (alt.single[j] && !field.name) continue // a lone letter reads the name only
            for (const ref of field.refs) {
              const s = scores[ref.id] * field.weight
              if (s > top) {
                top = s
                hit = { ref, name: field.name }
              }
            }
          }
          if (!hit) {
            sum = -1
            break
          }
          sum += top
          hits.push(hit)
        }
        if (sum < 0) continue
        const score = (sum / alt.words.length) * alt.weight
        if (!best || score > best.score) best = { score, hits }
      }
      if (!best) {
        ok = false
        break
      }
      total += best.score
      const nameHits = best.hits.filter((h) => h.name)
      if (nameHits.length) {
        inName++
        for (const h of nameHits) spans.push([h.ref.start, h.ref.end])
        const start = Math.min(...nameHits.map((h) => h.ref.start))
        if (k === 0 && start === 0) firstAtStart = true
        if (start < lastStart) inOrder = false
        lastStart = start
      }
    }
    if (!ok) continue
    let score = total
    if (firstAtStart) score += 12
    if (inName === terms.length) score += 10
    if (inName === terms.length && terms.length > 1 && inOrder) score += 6
    if (entry.namePieces) score += 8 * Math.min(1, inName / entry.namePieces)
    out.push({ row: entry.row, score, spans: mergeSpans(spans), name: entry.name })
  }
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  return out.slice(0, limit).map(({ row, score, spans }) => ({ row, score, spans }))
}

// One call for a list that is searched once (no index kept).
export function searchRows(rows, query, { describe = describeByName, ...opts } = {}) {
  return findMatches(buildIndex(rows, describe), query, opts)
}

function mergeSpans(spans) {
  const sorted = spans.slice().sort((a, b) => a[0] - b[0])
  const out = []
  for (const [s, e] of sorted) {
    const last = out[out.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else out.push([s, e])
  }
  return out
}

// The text cut at the spans, for rendering: [{ text, hit }].
export function highlightParts(text, spans) {
  const s = String(text ?? '')
  if (!spans?.length) return [{ text: s, hit: false }]
  const out = []
  let at = 0
  for (const [a, b] of spans) {
    if (a > at) out.push({ text: s.slice(at, a), hit: false })
    if (b > a) out.push({ text: s.slice(Math.max(a, at), b), hit: true })
    at = Math.max(at, b)
  }
  if (at < s.length) out.push({ text: s.slice(at), hit: false })
  return out
}
