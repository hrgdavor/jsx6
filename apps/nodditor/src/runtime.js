/**
 * The single integration point between nodditor and its JSX6 backend.
 *
 * Everything nodditor needs from the backend is the `NodeEditorRuntime` contract below, read
 * through `backend.current`. There is no other way in: [runtime-default.js](./runtime-default.js)
 * holds the real `@jsx6/*` imports and is the only file in the package allowed to have any
 * (enforced by [../test/runtime.test.js](../test/runtime.test.js)).
 *
 * What that buys:
 *
 *   - `setRuntime()` swaps the implementation without patching `node_modules` or aliasing packages,
 *     and a partial object is merged over the default, so changing one primitive is a one-liner;
 *   - the contract is the ~24 names below, not "all of `@jsx6/jsx6`" — the list is explicit, so
 *     adding a dependency is a reviewable change to this file rather than a stray import;
 *   - a standalone build has exactly one module to replace: alias `src/runtime-default.js` (or ship
 *     a bundle that does not include it) and nothing else in `src/` has to change.
 *
 * Two constraints are *not* abstraction gaps, they are properties of the platform:
 *
 *   1. `JsxW` is read when `class NodeEditor extends backend.current.JsxW` is evaluated, i.e. at
 *      import time — not per instance. A replacement must therefore be installed with
 *      `setRuntime()` before the editor module is imported (the same ordering `@jsx6/w` already
 *      requires for `define()`). Installing one later would leave the editor on the old base class.
 *   2. JSX compiles to `@jsx6/jsx-runtime` (see `src_build/buildScript.js`), so the JSX runtime is
 *      bound by the *build*, not by this module. A standalone build points `jsxImportSource` at its
 *      own runtime instead; that needs no source change at all.
 */

/** @typedef {import('./NodeEditor.jsx').BlockData} BlockData */

/**
 * The backend surface nodditor is written against.
 *
 * @typedef {object} NodeEditorRuntime
 * @property {Function} addClass add one or more class names to an element or props object
 * @property {Function} classIf add/remove `cname` according to a boolean (or a signal read)
 * @property {Function} findParent walk `parentElement` until the predicate matches
 * @property {Function} fireCustom dispatch a `CustomEvent` with `detail`
 * @property {Function} getAttr read an attribute (`null` when absent)
 * @property {Function} hSvg create an SVG-namespace element
 * @property {Function} insert insert a node/array/component-return into a parent
 * @property {Function} isNode duck-type check for a DOM node
 * @property {Function} listen `addEventListener` that returns its own unsubscribe function
 * @property {Function} listenCustom listener whose callback receives `event.detail`
 * @property {Function} provideErrTranslations install the default error-message translations
 * @property {Function} remove detach a node
 * @property {Function} runFuncNoArg call a value if it is callable, otherwise return it
 * @property {Function} setAttribute write (or remove, for `false`/`null`) an attribute
 * @property {Function} setSelected mark a block/line selected
 * @property {Function} setVisible show/hide an element
 * @property {Function} toDomNode normalise element | component | string to a DOM node
 * @property {Function} $Or derived signal: truthy when any argument is truthy
 * @property {Function} $State callable observable state proxy (`$s`, `$v`)
 * @property {Function} observeNow run a signal subscriber immediately, then on change
 * @property {Function} JsxW component base class the editor extends
 * @property {Function} define register a custom element
 * @property {Function} observeShowHide observe an element's intersection and report changes
 */

/** @type {NodeEditorRuntime | null} */
let replacement = null

/** @type {NodeEditorRuntime} */
let resolved = null

/**
 * The backend the editor uses.
 *
 * `current` is a property on a stable object rather than a module-level binding, so no module has
 * to re-import anything after `setRuntime()`, and the read is what resolves the replacement against
 * the default backend.
 *
 * @type {{ readonly current: NodeEditorRuntime }}
 */
export const backend = {
  get current() {
    if (!replacement) return defaultRuntime
    if (!resolved) resolved = { ...defaultRuntime, ...replacement }
    return resolved
  },
}

/**
 * Replace the backend. Must be called before the editor module is imported — see the note on
 * `JsxW` at the top of this file.
 *
 * A partial replacement is merged over the default, so a consumer that only needs to change how,
 * say, custom events are fired can supply one function. Mixing two implementations half-way is
 * possible but is the consumer's choice: the merge exists so the common case (one or two swapped
 * primitives, everything else from `@jsx6`) stays a one-liner.
 *
 * @param {Partial<NodeEditorRuntime>} implementation
 * @returns {import('./runtime.js').NodeEditorRuntime | null} the replacement that was in place, so callers can restore it
 */
export function setRuntime(implementation) {
  const previous = replacement
  replacement = implementation
  resolved = null
  return previous
}

/** Was a replacement installed (as opposed to running on the default backend)? */
export function hasRuntimeOverride() {
  return replacement !== null
}

// The real packages, imported in exactly one place. `runtime-default.js` is a plain module of
// re-exports with no behaviour of its own, which is what makes the mapping above the whole contract.
import { defaultRuntime } from './runtime-default.js'
