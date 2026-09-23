import { h } from './jsx2dom.js'

/**
 * @typedef {HTMLInputElement & {getValue: () => any, setValue: (v: any) => any}} HiddenInputElement
 */

/** Hidden input that is not limited to string values.
 *
 * Built with `h()` rather than JSX: this module ships as raw source on the ESM entry path
 * (`exports.default -> ./index.js`), so JSX here would force consumers to have a JSX-aware
 * loader configured for node_modules.
 *
 * @param {Object} attr
 * @returns {HiddenInputElement} hidden input element with getValue/setValue attached
 */
export const HiddenInput = attr => {
  let value
  let out = /** @type {HiddenInputElement} */ (h('input', { type: 'hidden', ...attr }))
  out.getValue = () => value
  out.setValue = v => (out.value = value = v)
  return out
}
