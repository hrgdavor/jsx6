/**
 * Shared DOM setup for the smoke-suite runners (p1/p2/p3/boot).
 *
 * Booting happy-dom and stubbing the observers every runner did for itself is easy to get subtly
 * different; more importantly the editor's structural layout lives in `static/nodditor.css` (the
 * canvas layer, block transform, zoom controls, marquee, menu) driven by CSS custom variables, so a
 * suite that does not load that file would only be testing the variable DEFAULTS — and would miss
 * exactly the class of bug that made blocks land in the corner in a real app. A host loads the
 * stylesheet, so the suites do too.
 */
import { readFileSync } from 'node:fs'

/** The library stylesheet, verbatim (for suites that want to reason about it). */
export const EDITOR_CSS = readFileSync(new URL('../static/nodditor.css', import.meta.url), 'utf8')
/** The demo look (menu chrome, editor box) — loaded alongside, as the demo page does. */
export const DEMO_CSS = readFileSync(new URL('../static/ne-demo.css', import.meta.url), 'utf8')
/**
 * The HOST block/connector stylesheet, verbatim. NOT installed by `setupDom()` (see the note there),
 * but exported so a suite can reason about class ownership against it.
 */
export const HOST_CSS = readFileSync(new URL('../static/ne-blocks.css', import.meta.url), 'utf8')

/**
 * Register the DOM globals and install the editor stylesheet.
 * Call once, before importing a suite bundle.
 */
export async function setupDom() {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
  GlobalRegistrator.register({ url: 'http://localhost/' })

  globalThis.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  globalThis.ResizeObserver = class {
    constructor(callback) {
      this.cb = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  const tag = document.createElement('style')
  tag.setAttribute('data-ne-editor-css', '')
  // The LIBRARY sheet only. The host block sheet (`ne-blocks.css`) is deliberately NOT loaded here:
  // it positions block internals (`[ne-connect] { position: absolute }`) and the p1/p3 suites fake
  // layout by hand, so loading it changes what those suites measure. The invariant that matters — the
  // library must never style a class the host markup owns — is asserted statically by
  // `SEAM-1e` and dynamically by `doc/feeding-data.run.mjs`.
  tag.textContent = EDITOR_CSS + '\n' + DEMO_CSS
  document.head.appendChild(tag)

  return { GlobalRegistrator }
}
