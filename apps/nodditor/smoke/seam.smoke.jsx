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
/** The one file allowed to import jsx6; `walk` paths are relative to the app root. */
const isDefaultBackend = file => file === DEFAULT_BACKEND || file === 'src/runtime-default.js'

const walk = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name).replaceAll('\\', '/')],
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

// ---------- SEAM-1: the allowed coupling points ----------
// Restoring the pre-refactor discovery path means three files import `@jsx6/*` directly on purpose
// (see test/runtime.test.js): `connectorUtil.js` statically, and `canvasLineLayer.js` dynamically
// imports the OPTIONAL `@jsx6/line-render` (unresolvable → warn → the SVG line layer stays). This
// suite pins that list instead of demanding a single importer, so adding a fourth direct import
// still fails here.
const DIRECT_IMPORTERS = ['NodeEditor.jsx', 'canvasLineLayer.js', 'connectorUtil.js']
const sourceFiles = walk(SRC).filter(f => /\.jsx?$/.test(f))
const offenders = []
const direct = []
for (const file of sourceFiles) {
  if (isDefaultBackend(file)) continue
  const found = jsx6Imports(readFileSync(file, 'utf8'))
  if (!found.size) continue
  const rel = file.replace(/^src\//, '')
  direct.push(rel)
  if (!DIRECT_IMPORTERS.includes(rel)) offenders.push(`${file} -> ${[...found].join(', ')}`)
}
ok(
  offenders.length === 0,
  `SEAM-1 only the documented files import @jsx6/* directly (${sourceFiles.length} files checked)`,
)
ok(
  direct.sort().join(',') === [...DIRECT_IMPORTERS].sort().join(','),
  `SEAM-1 the direct importers are exactly ${DIRECT_IMPORTERS.join(' + ')} (${direct.join(', ')})`,
)
if (offenders.length) console.error('     ' + offenders.join('\n     '))

/**
 * SEAM-1b: no module may call a backend primitive it no longer imports.
 *
 * This is the regression the seam refactor actually produced once: rewriting the imports left bare
 * `runFuncNoArg(...)` calls behind, which only fail at runtime (`ReferenceError`) and only on the
 * code path that uses them — `removeLine`/`clear`/`loadGraph` in that case. A static grep is a much
 * cheaper check than hoping the right test drives the right path.
 *
 * Method/property declarations of the same name are excluded: `fireCustom(el, name)` as a class
 * method and `setSelected(sel)` on `ConnectLine` are the editor's own API, not the backend's.
 */
const contractNames = [
  'addClass',
  'classIf',
  'findParent',
  'getAttr',
  'hSvg',
  'insert',
  'isNode',
  'listen',
  'listenCustom',
  'observeNow',
  'observeShowHide',
  'remove',
  'runFuncNoArg',
  'setAttribute',
  'setSelected',
  'setVisible',
  'toDomNode',
]
/**
 * Names the restored files call as their own direct imports, so a bare call is correct there. Only
 * `NodeEditor.jsx` and `connectorUtil.js` are exempt; every other module must still route through
 * `backend.current`.
 */
const DIRECT_CALL_OK = {
  'NodeEditor.jsx': [
    'classIf',
    'findParent',
    'getAttr',
    'hSvg',
    'insert',
    'isNode',
    'listen',
    'remove',
    'setAttribute',
    'setSelected',
    'setVisible',
    'toDomNode',
    'observeNow',
  ],
  'connectorUtil.js': ['getAttr', 'setAttribute', 'observeShowHide'],
}
const unwired = []
for (const file of sourceFiles) {
  if (isDefaultBackend(file)) continue
  const rel = file.replace(/^src\//, '')
  const exempt = DIRECT_CALL_OK[rel] ?? []
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
    for (const name of contractNames) {
      if (exempt.includes(name)) continue
      const call = new RegExp(`(^|[^.\\w$?])${name}\\s*\\(`)
      const decl = new RegExp(`^\\s*(async\\s+|static\\s+)?${name}\\s*\\([^)]*\\)\\s*\\{`)
      if (decl.test(line)) return
      if (call.test(line) && !line.includes(`backend.current.${name}`)) {
        unwired.push(`${file}:${i + 1} ${line.trim()}`)
      }
    }
  })
}
ok(
  unwired.length === 0,
  `SEAM-1b every backend call outside the restored files goes through backend.current (${unwired.length} stray)`,
)
if (unwired.length) console.error('     ' + unwired.join('\n     '))

/**
 * SEAM-1c: nothing writes inline styles.
 *
 * Styling belongs in `static/nodditor.css`; the dynamic parts are published as CSS custom
 * properties (`style.setProperty('--ne-…')`), which is the one allowed form because it is how the
 * stylesheet and the editor communicate. A direct `el.style.left = …` / `style.display = …`, or a
 * `style="…"` attribute in the JSX, is rejected: those are what made the marquee, the selection
 * status text and the line focus box appear in one host and not another.
 */
const styleWrites = []
for (const file of sourceFiles) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
    if (/\bstyle\s*=\s*["'`]/.test(line)) {
      styleWrites.push(`${file}:${i + 1} inline style attribute: ${line.trim()}`)
      return
    }
    // `style.setProperty(...)` is the allowed form; any other `.style.<prop> =` write is not
    const m = line.match(/\.style\.([A-Za-z]+)\s*=/)
    if (m && m[1] !== 'setProperty') {
      styleWrites.push(`${file}:${i + 1} .style.${m[1]} =: ${line.trim()}`)
    }
  })
}
ok(
  styleWrites.length === 0,
  `SEAM-1c no inline style manipulation (${styleWrites.length} found; CSS custom properties are the allowed form)`,
)
if (styleWrites.length) console.error('     ' + styleWrites.join('\n     '))

/**
 * SEAM-1d: the library stylesheet has to be COMPLETE.
 *
 * With no inline styles, `static/nodditor.css` is what turns the published custom properties into
 * layout — the editor is unusable without it (every block ends up at the origin, "in the corner").
 * So the rules the editor depends on are pinned here: dropping one in a refactor would otherwise only
 * show up as a broken app.
 */
const libraryCss = readFileSync('static/nodditor.css', 'utf8')
const requiredCss = [
  ['.ne-canvas', ['--ne-zoom', '--ne-zoom-w', '--ne-zoom-h', 'scale(']],
  ['.ne-block', ['position: absolute', '--ne-x', '--ne-y', 'translate']],
  ['.ne-svg-layer', ['position: absolute', 'pointer-events: none']],
  ['.ne-marquee', ['--ne-marquee-x', '--ne-marquee-y', '--ne-marquee-w', '--ne-marquee-h', 'z-index']],
  ['.ne-menu', ['position: absolute', '--ne-menu-x', '--ne-menu-y']],
  ['.ne-zoom-ui', ['position: absolute', 'z-index', 'pointer-events: auto']],
]
const missingCss = []
for (const [selector, needles] of requiredCss) {
  const block = libraryCss.match(new RegExp(`\\${selector}\\s*\\{[^}]*\\}`))?.[0]
  if (!block) {
    missingCss.push(`${selector}: rule missing`)
    continue
  }
  for (const needle of needles) {
    if (!block.includes(needle)) missingCss.push(`${selector}: missing "${needle}"`)
  }
}
ok(
  missingCss.length === 0,
  `SEAM-1d the library stylesheet (static/nodditor.css) has every rule the editor needs (${missingCss.length} missing)`,
)
if (missingCss.length) console.error('     ' + missingCss.join('\n     '))
// blocks must not be positioned with a comma-separated transform: naive CSS parsers (and happy-dom's
// computed-style serialiser) truncate it at the comma and lose the Y axis
ok(
  !/\.ne-block\s*\{[^}]*translate\(/.test(libraryCss),
  'SEAM-1d .ne-block positions with translateX()/translateY(), not translate(x, y)',
)

/**
 * SEAM-1e: a class the editor puts on an element must not collide with HOST block markup.
 *
 * `.ne-content` is a block's own body (see the block components and ne-blocks.css). Naming the canvas
 * layer `.ne-content` too did not just collide — with nodditor.css loading after ne-blocks.css it
 * OVERRODE the block bodies with `position: absolute`, so blocks collapsed into white strips and the
 * whole graph fell apart.
 *
 * `.ne-block` is the one deliberate overlap (it is the host's element identity): nodditor.css supplies
 * its geometry, ne-blocks.css its look. Any OTHER class defined in both files is a bug.
 */
const classNames = css =>
  new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.(ne-[a-z0-9-]+)/gi)].map(m => m[1]))
const libraryClasses = classNames(libraryCss)
const hostClasses = classNames(readFileSync('static/ne-blocks.css', 'utf8'))
const DELIBERATE_OVERLAP = ['ne-block']
const sharedClasses = [...libraryClasses].filter(n => hostClasses.has(n) && !DELIBERATE_OVERLAP.includes(n))
ok(
  sharedClasses.length === 0,
  `SEAM-1e no accidental class overlap between nodditor.css and the host stylesheet (${sharedClasses.join(', ') || 'none'})`,
)
if (sharedClasses.length) console.error('     shared: ' + sharedClasses.join(', '))

// the classes the editor itself puts on elements must exist in the library stylesheet
const editorSource = readFileSync('src/NodeEditor.jsx', 'utf8')
const emitted = [...editorSource.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/))
const unstyled = [...new Set(emitted)].filter(name => name.startsWith('ne-') && !libraryClasses.has(name))
ok(
  unstyled.length === 0,
  `SEAM-1e every ne-* class the editor emits has a rule in nodditor.css (${unstyled.join(', ') || 'all styled'})`,
)

// the canvas layer specifically must not use a name the host block markup owns
const canvasClass = editorSource.match(/<div class="(ne-[a-z-]+)">\{this\.svgLayer\}/)?.[1]
ok(
  !!canvasClass && !hostClasses.has(canvasClass),
  `SEAM-1e the canvas layer class (${canvasClass}) is not one the host markup uses`,
)

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
  // real jsx6 addClass: an ELEMENT gets `classList.add`, a props OBJECT gets its `class` string
  // extended — the merge is the point (a plain `class=` in JSX would clobber a host class)
  addClass: record('addClass', (node, add) => {
    const target = (node?.nodeType !== undefined ? node : (node?.el ?? node)) ?? {}
    const cl = target.classList
    if (cl) {
      if (String(add).includes(' '))
        String(add)
          .split(' ')
          .forEach(c => cl.add(c))
      else cl.add(add)
    } else if (typeof target === 'object' && target !== null) {
      const cur = target.class || ''
      target.class = cur ? `${cur} ${add}` : add
    }
    return target
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
// The replacement's `addClass` does the props-object merge the real one does — asserted directly,
// because that merge is the contract behaviour the block components depend on.
{
  const props = { class: 'host-class' }
  backend.current.addClass(props, 'ne-block')
  ok(props.class === 'host-class ne-block', `SEAM-4 addClass merges onto a props object (${props.class})`)
}
// Every contract key must still resolve after the merge, and the replacement must not smuggle an
// extra key into `backend.current` — the contract stays exactly the documented list.
const mergedKeys = Object.keys(backend.current)
const missing = contract.filter(k => !mergedKeys.includes(k))
const extra = mergedKeys.filter(k => !contract.includes(k)).sort()
ok(missing.length === 0, `SEAM-4 the merge keeps every contract key (${missing.join(',') || 'none missing'})`)
ok(extra.length === 0, `SEAM-4 no replacement-only key leaks into the contract (${extra.join(',') || 'none'})`)

// ---------- SEAM-5..8: a real editor on the replacement (imported AFTER setRuntime) ----------
const { NodeEditor } = await import('../src/NodeEditor.jsx')
const { Switch } = await import('../src/blocks/Switch.js')

const menu = document.createElement('div')
menu.className = 'ne-menu'
const editor = new NodeEditor({ menu: () => menu, typeMap: { Switch } })
document.body.appendChild(editor)

ok(editor.querySelector('svg') === editor.svgLayer, 'SEAM-5 tpl() built the svg layer')
ok(!!editor.querySelector('.ne-zoom-ui'), 'SEAM-5 tpl() inserted the zoom UI')
ok(editor.querySelector('.ne-sr-status') === null, 'SEAM-5 tpl() injects no selection-status element')

// The zoom controls are inserted BEFORE the canvas, and the canvas is a full-size absolutely
// positioned layer — with the default `z-index: auto` it paints on top and swallows the clicks, so
// the buttons are visible but dead. Assert the stacking, not just the presence of the markup.
{
  const zoomUI = editor.querySelector('.ne-zoom-ui')
  const zOf = el => Number(globalThis.getComputedStyle(el).zIndex)
  ok(
    zOf(zoomUI) > zOf(editor.contentArea),
    `SEAM-5 zoom controls stack above the canvas (${zOf(zoomUI)} > ${zOf(editor.contentArea)})`,
  )
  ok(
    globalThis.getComputedStyle(zoomUI).pointerEvents !== 'none',
    `SEAM-5 zoom controls accept pointer events (${globalThis.getComputedStyle(zoomUI).pointerEvents})`,
  )
  const buttons = [...zoomUI.querySelectorAll('.ne-zoom-bt')]
  ok(buttons.length === 3, `SEAM-5 zoom out / reset / in buttons are present (${buttons.length})`)
  const before = editor.zoom
  buttons[2].dispatchEvent(new MouseEvent('click', { bubbles: true }))
  ok(editor.zoom > before, `SEAM-5 zoom-in button raises the zoom (${before} -> ${editor.zoom})`)
  buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
  ok(editor.zoom === before, `SEAM-5 zoom-out button restores it (${editor.zoom})`)
  buttons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
  ok(editor.zoom === 1, `SEAM-5 reset button returns to 100% (${editor.zoom})`)
}

editor.add(<Switch />, '1', { pos: [30, 40], type: 'Switch' })
const b1 = editor.getBlockData('1')
const cons = [...b1.connectorMap.keys()].sort()
ok(cons.join(',') === 'i1,o1,o2,o3', `SEAM-6 connector discovery found ${cons.join(',')}`)
// Discovery runs on the pre-refactor path: `NodeEditor`/`connectorUtil` call `toDomNode`,
// `setAttribute`, `insert`, `getAttr` and `observeShowHide` as their own direct imports, so the
// replacement runtime does NOT intercept them. Assert the outward behaviour instead of the routing.
ok(
  b1.el.tagName === 'DIV' && b1.el.getAttribute('nid') === '1' && editor.contentArea.contains(b1.el),
  'SEAM-6 the block was converted, attributed and inserted into the canvas',
)
ok(
  typeof b1.connectorMap.get('i1')?.el?.removeObserve === 'function',
  'SEAM-6 every discovered connector got its dom-observer cleanup wiring',
)
// The block component merged `ne-block` into its props object before JSX turned it into an element
// (block components reach the backend directly, like any host component would).
ok(calls.includes('addClass'), 'SEAM-6 the block component merged ne-block through replacement.addClass')
ok(
  b1.el.classList.contains('ne-block'),
  `SEAM-6 addClass reached the element's class list (class="${b1.el.className}")`,
)

// a host-supplied class must SURVIVE the editor's own class — this is what addClass buys over
// writing `class="ne-block"` in the JSX (which would win or lose by spread order)
{
  const hostClass = 'vb'
  const hostBlock = editor.add(<Switch class={hostClass} />, 'host1', { pos: [0, 0], type: 'Switch' })
  const classes = hostBlock.el.className
  ok(
    classes.includes('ne-block') && classes.includes(hostClass),
    `SEAM-6 a host class is merged, not overwritten (class="${classes}")`,
  )
}

editor.add(<Switch />, '2', { pos: [30, 260], type: 'Switch' })
editor.addConnectorFromTo('1/o1', '2/i1')
ok(editor.lines.length === 1, 'SEAM-7 a line was created through the replacement')
const line = editor.lines[0]
ok(editor.svgLayer.contains(line.el), 'SEAM-7 the line is in the svg layer')
ok(line.p1.con?.idFull === '1/o1' && line.p2.con?.idFull === '2/i1', 'SEAM-7 the line endpoints are correct')
// `hSvg` and `classIf` are called directly now; `listenCustom` still goes through the seam.
ok(calls.includes('listenCustom'), 'SEAM-7 the editor called replacement.listenCustom')
ok(line.el.namespaceURI === 'http://www.w3.org/2000/svg', 'SEAM-7 the line element is real SVG (hSvg path)')

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
ok(
  seen.some(d => d?.nid === '1'),
  'SEAM-7 the block-level ne-move still carries the block id',
)
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
