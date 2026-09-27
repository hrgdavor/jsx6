/**
 * The default backend: thin re-exports of the JSX6 packages.
 *
 * **This is the only file in the package that imports a `@jsx6/*` package.** [runtime.js](./runtime.js)
 * imports it eagerly, so the real packages are always evaluated when nodditor is loaded — installing
 * a replacement with `setRuntime()` changes which implementation is used, not what is on disk. A
 * build that must not pull `@jsx6/*` in at all replaces *this* module (see the "Replacing the
 * backend" section of the README).
 *
 * Nothing else should be imported from here: consumers go through `backend.current`, so a
 * replacement only has to produce the same names (see the `NodeEditorRuntime` typedef in
 * runtime.js).
 */
import {
  addClass,
  classIf,
  findParent,
  fireCustom,
  getAttr,
  hSvg,
  insert,
  isNode,
  listen,
  listenCustom,
  provideErrTranslations,
  remove,
  runFuncNoArg,
  setAttribute,
  setSelected,
  setVisible,
  toDomNode,
} from '@jsx6/jsx6'
import { $Or, $State, observeNow } from '@jsx6/signal'
import { JsxW, define } from '@jsx6/w'
import { observeShowHide } from '@jsx6/dom-observer'

/** @type {import('./runtime.js').NodeEditorRuntime} */
export const defaultRuntime = {
  addClass,
  classIf,
  findParent,
  fireCustom,
  getAttr,
  hSvg,
  insert,
  isNode,
  listen,
  listenCustom,
  provideErrTranslations,
  remove,
  runFuncNoArg,
  setAttribute,
  setSelected,
  setVisible,
  toDomNode,
  $Or,
  $State,
  observeNow,
  JsxW,
  define,
  observeShowHide,
}
