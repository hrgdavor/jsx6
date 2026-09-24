import { toDom, isNode } from '@jsx6/jsx6'
import { activateJsxInspector } from './src/activateJsxInspector.js'

/**
 * Dev JSX runtime plus the optional click-to-editor JSX inspector.
 *
 * Inspector contract:
 *
 * - importing this module does not install anything by default: the unconditional
 *   `activateJsxInspector()` call that used to run at import time is gone, so a bundler may
 *   safely drop the module when `jsxDEV` is not used (`package.json` no longer claims the whole
 *   package is side-effect free, see `sideEffects`);
 * - the inspector is installed lazily on the first `jsxDEV()` call, which keeps the existing dev
 *   behaviour without an import-time side effect;
 * - `globalThis.JSX6_DEV_INSPECTOR = false` disables the automatic (lazy) installation, which is
 *   what tests and SSR setups without a `document` want; the explicit API keeps working;
 * - `globalThis.JSX6_DEV_INSPECTOR = true` set before the first import opts into an immediate
 *   installation at import time;
 * - {@link installInspector}/{@link isInspectorInstalled} are the explicit API and are
 *   idempotent per root. `@jsx6/w` keeps using the `globalThis.activateJsxInspector` helper that
 *   the inspector module publishes for its shadow roots, so dev code jump is unaffected.
 */

/**
 * roots that already have the inspector contextmenu listener
 *
 * @type {WeakSet<HTMLElement>}
 */
const inspectedRoots = new WeakSet()

/**
 * The explicit opt-in/opt-out flag, read from `JSX6_DEV_INSPECTOR`. It is a plain global so it
 * can be set by a host page before any module loads.
 *
 * @returns {boolean|undefined}
 */
const readInspectorFlag = () => /** @type {any} */ (globalThis).JSX6_DEV_INSPECTOR

/**
 * Install the click-to-editor JSX inspector: a `contextmenu` listener that marks rendered
 * elements with their `_src` JSX location and opens the editor for ctrl+right-click.
 *
 * Installing twice on the same root is a no-op, otherwise every call would add another listener.
 *
 * @param {HTMLElement} [root] element the listener is registered on, defaults to `document.body`
 * @returns {boolean} true when this call installed the inspector
 */
export function installInspector(root = globalThis.document?.body) {
  if (!root || inspectedRoots.has(root)) return false
  activateJsxInspector(root)
  inspectedRoots.add(root)
  return true
}

/**
 * @param {HTMLElement} [root] element to test, defaults to `document.body`
 * @returns {boolean} true when the inspector listener is installed on `root`
 */
export function isInspectorInstalled(root = globalThis.document?.body) {
  return !!root && inspectedRoots.has(root)
}

/** install the inspector on first use unless it was explicitly disabled */
function ensureInspector() {
  if (readInspectorFlag() === false) return
  installInspector()
}

/**
 * JSX factory used by the dev runtime (jsxDEV).
 *
 * @param {*} tag element tag, component function or Fragment
 * @param {{children?: *, [attr: string]: *}} [props] JSX attributes; `children` is handled separately
 * @param {*} [key]
 * @param {*} [isStatic]
 * @param {{fileName?: string, lineNumber?: number, columnNumber?: number}} [source] JSX source location
 */
function jsxDEV(tag, { children, ...attr } = {}, key, isStatic, source) {
  ensureInspector()
  try {
    if (tag === Fragment) return children

    let out = toDom(tag, attr, children)
    if (isNode(out)) out._source = source
    return out
  } catch (e) {
    // TypeScript 7 types `catch` bindings as `unknown`; narrow before reading `.message`.
    const message = e instanceof Error ? e.message : String(e)
    console.log(
      'ERROR while creating DOM from JSX\n' +
        message +
        '\n  at: JSX (' +
        source?.fileName +
        ':' +
        source?.lineNumber +
        ':' +
        source?.columnNumber +
        ')\n',
    )
    console.log('tag:', tag)
    console.log('attributes:', attr)
    console.log('children:', children)
    throw e
  }
}

// will not be called, we intercept the reference and return children in jsxDEV
var Fragment = (attr, children) => children

// explicit opt-in: install immediately, before the first element is created
if (readInspectorFlag() === true) installInspector()

export { jsxDEV, Fragment }
