/**
 * Seam smoke test — proves nodditor runs on a REPLACED backend, under happy-dom (register the DOM
 * globals and stub IntersectionObserver BEFORE importing this file; see seam.run.mjs).
 *
 * Order matters and is part of what is being tested: `setRuntime()` is called before the editor
 * module is imported, because `NodeEditor` extends `backend.current.JsxW` at module-evaluation time.
 *
 * Asserts:
 *  SEAM-1 `src/runtime-default.js` is the only module importing `@jsx6/*`
 *  SEAM-2 the default backend re-exports exactly the four packages the app declares
 *  SEAM-3 the contract surface is stable and entirely callable
 *  SEAM-4 `setRuntime()` replaces primitives, keeps the rest, and `setRuntime(null)` restores
 *  SEAM-5 a real editor boots on a replacement base class (no `@jsx6/w` involved)
 *  SEAM-6 the editor's calls actually ARRIVE at the replacement (not just "it still works")
 *  SEAM-7 a connected line, `ne-move` batching and `fireCustom` work through the replacement
 *  SEAM-8 `removeBlock` and teardown work through the replacement
 */
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

import { backend, hasRuntimeOverride, setRuntime } from '../src/runtime.js'

let failures = 0
const ok = (cond, msg) => {
  if (cond) console.log('ok   ' + msg)
  else {
    failures++
    console.error('FAIL ' + msg)
  }
}

const SRC = 'src'
const DEFAULT_BACKEND = join(SRC, 'runtime-default.js')

const walk = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  )

/** Static import/export/require/dynamic-import of a `@jsx6/*` package in `source`. */
const jsx6Imports = source => {
  const found = new Set()
  const patterns = [
    /(?:^|[\n;}])\s*(?:import|export)\b[^;'"]*?\bfrom\s*['"](@jsx6\/[^'"]+)['"]/g,
    /(?:^|[\n;}])\s*import\s*['"](@jsx6\/[^'"]+)['"]/g,
    /\brequire\s*\(\s*['"](@jsx6\/[^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"](@jsx6\/[^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) for (const m of source.matchAll(re)) found.add(m[1])
  return found
}

// ---------- SEAM-1: one coupling point ----------
const sourceFiles = walk(SRC).filter(f => /\.jsx?$/.test(f))
const offenders = []
for (const file of sourceFiles) {
  if (file === DEFAULT_BACKEND) continue
  const found = jsx6Imports(readFileSync(file, 'utf8'))
  if (found.size) offenders.push(`${file} -> ${[...found].join(', ')}`)
}
ok(offenders.length === 0, `SEAM-1 only runtime-default.js imports @jsx6/* (${sourceFiles.length} files)`)
if (offenders.length) console.error('     ' + offenders.join('\n     '))

// ---------- SEAM-2: the default backend is the app's four dependencies ----------
const defaultImports = [...jsx6Imports(readFileSync(DEFAULT_BACKEND, 'utf8'))].sort()
ok(
  defaultImports.join(',') === '@jsx6/dom-observer,@jsx6/jsx6,@jsx6/signal,@jsx6/w',
  `SEAM-2 default backend imports ${defaultImports.join(', ')}`,
)

// ---------- SEAM-3: contract surface ----------
const defaults = backend.current
const contract = Object.keys(defaults).sort()
const expected = [
  '$Or',
  '$State',
  'JsxW',
  'addClass',
  'classIf',
  'define',
  'findParent',
  'fireCustom',
  'getAttr',
  'hSvg',
  'insert',
  'isNode',
  'listen',
  'listenCustom',
  'observeNow',
  'observeShowHide',
  'provideErrTranslations',
  'remove',
  'runFuncNoArg',
  'setAttribute',
  'setSelected',
  'setVisible',
  'toDomNode',
].sort()
ok(contract.join(',') === expected.join(','), `SEAM-3 contract is exactly the ${expected.length} documented names`)
const notCallable = contract.filter(n => typeof defaults[n] !== 'function')
ok(notCallable.length === 0, `SEAM-3 every contract name is callable${notCallable.length ? `: ${notCallable}` : ''}`)

// ---------- the replacement backend ----------
const calls = []
let lastCall = null
const record =
  (name, impl) =>
  (...args) => {
    calls.push(name)
    lastCall = name
    return impl(...args)
  }

const asNode = el => (el?.nodeType !== undefined ? el : el?.el)

/** `$s`/`$v`: a callable proxy whose properties are signals (the shape JsxW hands the template). */
const makeState = initial => {
  const target = typeof initial === 'object' && initial !== null ? initial : { value: initial }
  const sigs = new Map()
  const sig = k => {
    if (!sigs.has(k)) {
      let v = target[k]
      const f = (...args) => {
        if (!args.length) return v
        v = args[0]
        return v
      }
      f.subscribe = () => () => {}
      sigs.set(k, f)
    }
    return sigs.get(k)
  }
  return () => new Proxy(target, { get: (t, k) => sig(k), set: (t, k, v) => ((target[k] = v), true) })
}

const replacement = {
  addClass: record('addClass', (node, add) => {
    const n = node?.nodeType !== undefined ? node : (node?.el ?? node)
    if (!n) return
    if (n.classList) {
      if (String(add).includes(' ')) add.split(' ').forEach(c => n.classList.add(c))
      else n.classList.add(add)
    } else n.class = n.class ? `${n.class} ${add}` : add
  }),
  // real jsx6 classIf: add/remove `cname` according to a boolean or a signal read
  classIf: record('classIf', (node, cname, on) => {
    const v = typeof on === 'function' ? on() : on
    asNode(node)?.classList?.toggle(cname, !!v)
  }),
  findParent: record('findParent', (el, predicate) => {
    let p = el
    while (p) {
      if (predicate(p)) return p
      p = p.parentElement
    }
    return null
  }),
  fireCustom: record('fireCustom', (el, name, detail = {}) =>
    asNode(el)?.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true })),
  ),
  getAttr: record('getAttr', (el, name) => asNode(el)?.getAttribute(name)),
  hSvg: record('hSvg', (tag, attr = {}, ...children) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [k, v] of Object.entries(attr)) if (v != null) el.setAttribute(k, String(v))
    for (const c of children.flat()) {
      const node = asNode(c)
      if (node?.nodeType !== undefined) el.appendChild(node)
      else if (c != null) el.appendChild(document.createTextNode(String(c)))
    }
    return el
  }),
  // jsx2dom's insert understands components (`.el`), arrays and text — the editor relies on all three
  insert: record('insert', (parent, child, before) => {
    const p = asNode(parent)
    for (const c of Array.isArray(child) ? child : [child]) {
      if (c == null) continue
      const node = asNode(c)
      if (node?.nodeType !== undefined) p.insertBefore(node, before ? asNode(before) : null)
      else
        p.insertBefore(document.createTextNode(typeof c === 'object' ? '' : String(c)), before ? asNode(before) : null)
    }
    return child
  }),
  isNode: record('isNode', v => !!v && typeof v === 'object' && v.nodeType !== undefined),
  listen: record('listen', (el, name, cb, options) => {
    const n = asNode(el)
    n.addEventListener(name, cb, options)
    return () => n.removeEventListener(name, cb, options)
  }),
  // real jsx6 listenCustom hands the callback `event.detail` — ConnectLine's stamp test depends on it
  listenCustom: record('listenCustom', (el, name, cb, options) => {
    const n = asNode(el)
    const wrapped = e => cb(e.detail || {}, e)
    n.addEventListener(name, wrapped, options)
    return () => n.removeEventListener(name, wrapped, options)
  }),
  provideErrTranslations: record('provideErrTranslations', () => {}),
  remove: record('remove', el => {
    const n = asNode(el)
    n?.parentNode?.removeChild(n)
  }),
  runFuncNoArg: record('runFuncNoArg', (fn, ...args) => (typeof fn === 'function' ? fn(...args) : fn)),
  setAttribute: record('setAttribute', (el, name, value) => {
    const n = asNode(el)
    if (value === false || value === null || value === undefined) n.removeAttribute(name)
    else n.setAttribute(name, value === true ? '' : String(value))
  }),
  setSelected: record('setSelected', (el, value) => {
    if (typeof el?.setSelected === 'function') return el.setSelected(value)
    asNode(el)?.classList?.toggle('selected', !!value)
  }),
  setVisible: record('setVisible', (el, value) => {
    const n = asNode(el)
    // the editor's own CSS hides `[hidden]`, which is what the real setVisible toggles
    if (value) n.removeAttribute('hidden')
    else n.setAttribute('hidden', '')
  }),
  toDomNode: record('toDomNode', v => {
    if (v == null) return document.createTextNode('')
    if (v.nodeType !== undefined) return v
    if (v.el?.nodeType !== undefined) return v.el
    return document.createTextNode(String(v))
  }),
  $Or: record('$Or', (...args) => {
    const out = () => args.some(a => (typeof a === 'function' ? a() : a))
    out.subscribe = () => () => {}
    return out
  }),
  $State: record('$State', makeState),
  observeNow: record('observeNow', (signal, fn) => {
    fn(typeof signal === 'function' ? signal() : signal)
    return () => {}
  }),
  JsxW: class JsxW extends HTMLElement {
    constructor(attr = {}, children = [], parent) {
      super()
      this.contentArea = null
      const el = this.tpl(attr, children, parent)
      if (el && el !== this) replacement.insert(this, el)
      this.onCreate?.()
    }
    // the real base class hands `$s`/`$v` to the template — NodeEditor relies on both
    get $s() {
      return (this._$s ??= makeState({}))
    }
    get $v() {
      return (this.__$v ??= makeState({}))
    }
    tpl() {
      return null
    }
  },
  define: record('define', (tag, ctor) => {
    if (!customElements.get(tag)) customElements.define(tag, ctor)
  }),
  // libs/dom-observer stores one shared IntersectionObserver per root; connectorUtil only ever
  // removes on a FALSY `intersectionRatio`, so never invoking the handler is the faithful stand-in
  // for happy-dom, which has no IntersectionObserver at all.
  observeShowHide: record('observeShowHide', (el, handler, options) => {
    void handler
    void options
    void el
    return () => {}
  }),
}

// ---------- SEAM-4: setRuntime replaces primitives, keeps the rest ----------
ok(hasRuntimeOverride() === false, 'SEAM-4 no override before setRuntime()')
ok(setRuntime(replacement) === null, 'SEAM-4 setRuntime() reports the previous (null) override')
ok(hasRuntimeOverride() === true, 'SEAM-4 override is active')
ok(backend.current !== defaults, 'SEAM-4 backend.current is no longer the default object')
ok(backend.current.addClass !== defaults.addClass, 'SEAM-4 the replaced primitive is in effect')
ok(backend.current.insert === replacement.insert, 'SEAM-4 the replacement is used for other primitives')
ok(Object.keys(backend.current).length === contract.length, 'SEAM-4 the merge keeps the contract complete')

// ---------- SEAM-5..8: a real editor on the replacement (imported AFTER setRuntime) ----------
const { NodeEditor } = await import('../src/NodeEditor.jsx')
const { Switch } = await import('../src/blocks/Switch.js')

const menu = document.createElement('div')
menu.className = 'ne-menu'
const editor = new NodeEditor({ menu: () => menu, typeMap: { Switch } })
document.body.appendChild(editor)

ok(editor.querySelector('svg') === editor.svgLayer, 'SEAM-5 tpl() built the svg layer')
ok(!!editor.querySelector('.ne-zoom-ui'), 'SEAM-5 tpl() inserted the zoom UI')
ok(editor.querySelector('.ne-sr-status').className === 'ne-sr-status', 'SEAM-5 the aria-live region exists')

editor.add(<Switch />, '1', { pos: [30, 40], type: 'Switch' })
const b1 = editor.getBlockData('1')
const cons = [...b1.connectorMap.keys()].sort()
ok(cons.join(',') === 'i1,o1,o2,o3', `SEAM-6 connector discovery found ${cons.join(',')}`)
for (const name of ['toDomNode', 'setAttribute', 'insert', 'getAttr', 'observeShowHide', 'addClass']) {
  ok(calls.includes(name), `SEAM-6 the editor called replacement.${name}`)
}

editor.add(<Switch />, '2', { pos: [30, 260], type: 'Switch' })
editor.addConnectorFromTo('1/o1', '2/i1')
ok(editor.lines.length === 1, 'SEAM-7 a line was created through the replacement')
const line = editor.lines[0]
ok(editor.svgLayer.contains(line.el), 'SEAM-7 the line is in the svg layer')
ok(line.p1.con?.idFull === '1/o1' && line.p2.con?.idFull === '2/i1', 'SEAM-7 the line endpoints are correct')
for (const name of ['hSvg', 'listenCustom', 'classIf']) {
  ok(calls.includes(name), `SEAM-7 the editor called replacement.${name}`)
}

const seen = []
editor.addEventListener('ne-move', e => seen.push(e.detail))
const before = line.line1.getAttribute('d')
editor.setPos('1', [200, 150])
editor.fireMove(editor.getBlockData('1'))
ok(seen.length > 0, 'SEAM-7 ne-move reached the element as a CustomEvent')
ok(
  seen[0]?.connectors?.some(c => c.idFull === '1/o1'),
  'SEAM-7 the ne-move batch carries 1/o1',
)
ok(lastCall === 'fireCustom', `SEAM-7 the last replacement call was fireCustom (${lastCall})`)
ok(before !== line.line1.getAttribute('d'), 'SEAM-7 the line followed the moved connector')

editor.removeBlock(editor.getBlockData('1'))
ok(editor.getBlockData('1') == null, 'SEAM-8 removeBlock dropped the block')
ok(editor.lines.length === 0, 'SEAM-8 the connected line went with it')
editor.destroy()
ok(editor.blocks.length === 0 && editor.lines.length === 0, 'SEAM-8 destroy() emptied the editor')

// ---------- SEAM-4 (restore) ----------
setRuntime(null)
ok(hasRuntimeOverride() === false, 'SEAM-4 setRuntime(null) cleared the override')
ok(backend.current.addClass === defaults.addClass, 'SEAM-4 the default backend is back')

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL SMOKE ASSERTIONS PASSED')
process.exitCode = failures ? 1 : 0
