// Catch the temporal-dead-zone crash that keeps reaching production.
//
// A React component's `const x = useMemo(() => …, [deps])` FACTORY RUNS during
// render, at its own line. So if its body or its dependency array reads a const
// declared further down the same function, the page dies with
//   ReferenceError: Cannot access 'y' before initialization
// and takes the whole view with it.
//
// Nothing else in the toolchain sees this: `npm run build` compiles it happily,
// oxlint does not implement no-use-before-define (checked: even
// `const a = b + 1; const b = 2` passes), and exhaustive-deps is satisfied
// because the dependency array matches the reference. It has now shipped three
// times — livePeople, packProg, brands.
//
// Deliberately simple and file-scoped: it flags a hook initializer that names a
// const declared LATER in the same file. Same trade-off as audit-jsx-props —
// read the survivors rather than trusting the count.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['src']
const files = []
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(jsx?|mjs)$/.test(p)) files.push(p)
  }
}
ROOTS.forEach(walk)

const HOOK = /\b(useMemo|useCallback)\s*\(/g
let findings = 0

// Comments and string contents are not code. A comment inside a hook that said
// a studio isn't "free" once matched a `const free` in ANOTHER function and was
// reported as a read — the cry-wolf this tool must not do. Template literals
// keep their `${…}` expressions, because those ARE reads. A tiny state machine,
// not a parser: a regex literal holding `//` can still fool it, which only ever
// HIDES identifiers (a missed suspect), never invents one.
function codeOnly(text) {
  let out = ''
  const modes = ['code'] // 'code' | 'tpl'; a 'code' above the base came from `${`
  const depth = [0] // open braces per mode, so `}` knows when a `${…}` ends
  let i = 0
  while (i < text.length) {
    const c = text[i]
    const next = text[i + 1]
    if (modes[modes.length - 1] === 'tpl') {
      if (c === '\\') {
        i += 2
      } else if (c === '`') {
        modes.pop()
        depth.pop()
        out += ' '
        i++
      } else if (c === '$' && next === '{') {
        modes.push('code')
        depth.push(0)
        out += ' '
        i += 2
      } else {
        i++
      }
      continue
    }
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      const close = text.indexOf('*/', i + 2)
      i = close < 0 ? text.length : close + 2
      out += ' '
      continue
    }
    if (c === "'" || c === '"') {
      i++
      while (i < text.length && text[i] !== c && text[i] !== '\n') i += text[i] === '\\' ? 2 : 1
      i++
      out += ' '
      continue
    }
    if (c === '`') {
      modes.push('tpl')
      depth.push(0)
      out += ' '
      i++
      continue
    }
    if (c === '{') depth[depth.length - 1]++
    if (c === '}') {
      if (depth[depth.length - 1] === 0 && modes.length > 1) {
        modes.pop()
        depth.pop()
        out += ' '
        i++
        continue
      }
      depth[depth.length - 1]--
    }
    out += c
    i++
  }
  return out
}

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')

  // Every `const NAME =` with the line it is declared on. Later duplicates in
  // other scopes only make the check more conservative, never less.
  // Keep the indentation too: the bug is always a sibling in the SAME function
  // body, while the noise is same-named locals inside other functions, which sit
  // deeper. Comparing indents is a cheap stand-in for real scope analysis.
  const declLine = new Map()
  lines.forEach((l, i) => {
    const m = l.match(/^(\s*)const\s+([A-Za-z_$][\w$]*)\s*=/)
    if (m && !declLine.has(m[2])) declLine.set(m[2], { line: i, indent: m[1].length })
  })

  let m
  while ((m = HOOK.exec(src)) !== null) {
    // The line the hook call sits on, and the assignment it belongs to.
    const upto = src.slice(0, m.index)
    const line = upto.split('\n').length - 1
    const owner = lines[line].match(/^\s*const\s+([A-Za-z_$][\w$]*)\s*=/)?.[1] ?? null

    // Balance parens to get the whole call, then scan it for identifiers.
    let depth = 0
    let end = m.index + m[0].length - 1
    for (; end < src.length; end++) {
      if (src[end] === '(') depth++
      else if (src[end] === ')') {
        depth--
        if (depth === 0) break
      }
    }
    // PROPERTY ACCESS IS NOT A BINDING: `item.units` cannot trip a temporal
    // dead zone, only a bare `units` can. Stripping `.name` (and `?.name`)
    // before scanning removes a whole class of false alarm — and a tool whose
    // job is to be believed cannot cry wolf.
    const body = codeOnly(src.slice(m.index, end + 1)).replace(/\??\.\s*[A-Za-z_$][\w$]*/g, ' ')
    // The hook call's own last line. A const declared INSIDE the callback is a
    // local — the overwhelming majority of matches — and only a declaration
    // BELOW the whole call can be the outer-scope one that has not run yet.
    const endLine = src.slice(0, end).split(String.fromCharCode(10)).length - 1
    const seen = new Set()
    for (const id of body.match(/[A-Za-z_$][\w$]*/g) || []) {
      if (seen.has(id) || id === owner) continue
      seen.add(id)
      const d = declLine.get(id)
      const ownIndent = lines[line].match(/^(\s*)/)[1].length
      if (d !== undefined && d.line > endLine && d.indent === ownIndent) {
        console.log(
          `TDZ  ${file}:${line + 1}  ${owner ?? '(hook)'} reads "${id}", declared later at line ${d.line + 1}`,
        )
        findings++
      }
    }
  }
}

console.log(findings ? `\n${findings} suspect(s)` : 'No use-before-declaration in a hook initializer.')
process.exit(0)
