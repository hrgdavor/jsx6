/**
 * happy-dom capability probe — NOT a test (the name deliberately does not match the
 * `.test.*` pattern the gate discovers, and it is not shipped: `test/` is outside the
 * package's `files`).
 *
 * Run it after touching a DOM test, and always after bumping happy-dom:
 *
 *   cd apps/nodditor && bun test/happy-dom-capabilities.mjs
 *
 * Every line is a claim that DOM tests in this repo depend on; the output is the evidence
 * for the table in AGENTS.md §2. When a claim changes, fix the table and the tests that
 * rely on it — do not "fix" the tests by weakening them.
 *
 * It prints and never throws: a missing API is a finding, not a crash.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register({ url: 'http://localhost/' })

const lines = []
const say = (name, value) => lines.push(`${String(name).padEnd(58)} ${value}`)
/** Report a probe's value, or the error it throws (a missing API IS the finding). */
const probe = (name, fn) => {
  try {
    say(name, fn())
  } catch (err) {
    say(name, `THROWS ${err?.message ?? err}`)
  }
}
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms))

try {
  const pkg = await import('happy-dom/package.json', { with: { type: 'json' } })
  say('happy-dom version', pkg.default.version)
} catch (err) {
  say('happy-dom version', `unknown (${err?.message ?? err})`)
}

// --- custom properties through getComputedStyle ------------------------------
const detached = document.createElement('div')
detached.style.setProperty('--x', '1px')
say('custom prop, DETACHED + inline', JSON.stringify(getComputedStyle(detached).getPropertyValue('--x')))

const attached = document.createElement('div')
document.body.appendChild(attached)
attached.style.setProperty('--x', '1px')
say('custom prop, ATTACHED + inline', JSON.stringify(getComputedStyle(attached).getPropertyValue('--x')))
say('  ... and the style attribute holds it', JSON.stringify(attached.getAttribute('style')))

const parent = document.createElement('div')
parent.appendChild(attached)
parent.style.setProperty('--y', '2px')
say('custom prop, INHERITED from a parent', JSON.stringify(getComputedStyle(attached).getPropertyValue('--y')))

const style = document.createElement('style')
style.textContent = 'div { --from-rule: 3px } .themed { --from-class: 4px }'
document.head.appendChild(style)
say('custom prop, from a <style> RULE', JSON.stringify(getComputedStyle(attached).getPropertyValue('--from-rule')))
attached.classList.add('themed')
say(
  'custom prop, from a <style> CLASS rule',
  JSON.stringify(getComputedStyle(attached).getPropertyValue('--from-class')),
)

const strokeProbe = document.createElement('div')
document.body.appendChild(strokeProbe)
strokeProbe.style.stroke = '#ff0000'
say('getComputedStyle(...).stroke, inline #ff0000', JSON.stringify(getComputedStyle(strokeProbe).stroke))
strokeProbe.style.stroke = 'black'
say('getComputedStyle(...).stroke, inline black', JSON.stringify(getComputedStyle(strokeProbe).stroke))

// --- ONE mutation per observer (batching two hides which one reported) -------
const observed = document.createElement('div')
document.body.appendChild(observed)
/** @type {string[]} */
let records = []
const mo = new MutationObserver(rs => {
  for (const r of rs) records.push(r.attributeName ? `attr:${r.attributeName}` : r.type)
})
mo.observe(observed, { attributes: true, childList: true, characterData: true, subtree: true })
const mark = label => {
  const seen = records
  records = []
  return `${label} -> ${seen.length ? seen.join(',') : '(none)'}`
}
observed.style.setProperty('--z', '1px')
await tick()
say('MutationObserver: style.setProperty()', mark('style.setProperty'))
observed.setAttribute('style', '--z: 2px')
await tick()
say('MutationObserver: setAttribute("style", ...)', mark('setAttribute style'))
observed.classList.add('dark')
await tick()
say('MutationObserver: classList.add()', mark('classList.add'))
observed.setAttribute('data-x', '1')
await tick()
say('MutationObserver: setAttribute("data-x", ...)', mark('setAttribute data-x'))
observed.appendChild(document.createElement('span'))
await tick()
say('MutationObserver: appendChild()', mark('appendChild'))
observed.textContent = 'text'
await tick()
say('MutationObserver: textContent =', mark('textContent'))

// --- scheduling, geometry, globals the tests rely on -------------------------
probe('requestAnimationFrame fires', () => typeof requestAnimationFrame == 'function')
const rafMs = await new Promise(resolve => {
  const t0 = Date.now()
  requestAnimationFrame(() => resolve(Date.now() - t0))
})
say('requestAnimationFrame latency (ms)', rafMs)

const rect = observed.getBoundingClientRect()
say('getBoundingClientRect()', JSON.stringify({ x: rect.x, y: rect.y, w: rect.width, h: rect.height }))
say('getComputedStyle(el).width of a div', JSON.stringify(getComputedStyle(observed).width))

say('window.devicePixelRatio (default)', window.devicePixelRatio)
window.devicePixelRatio = 2
say('window.devicePixelRatio writable', window.devicePixelRatio)
window.devicePixelRatio = 1

const mql = window.matchMedia('(resolution: 1dppx)')
let mqlFired = 0
mql.addEventListener('change', () => mqlFired++)
mql.dispatchEvent(new Event('change'))
say('matchMedia.change via dispatchEvent reaches a listener', mqlFired)

for (const name of [
  'MutationObserver',
  'ResizeObserver',
  'IntersectionObserver',
  'PointerEvent',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'DOMRect',
  'MediaQueryList',
  'HTMLCanvasElement',
  'structuredClone',
]) {
  say(`typeof ${name}`, typeof globalThis[name])
}
probe('document.elementFromPoint(1, 1)', () =>
  String(document.elementFromPoint(1, 1)?.tagName ?? document.elementFromPoint(1, 1)),
)
probe('canvas.getContext("2d")', () => String(document.createElement('canvas').getContext('2d')))
probe('canvas.getContext("webgpu")', () => String(document.createElement('canvas').getContext('webgpu')))
probe('svg path getTotalLength()', () =>
  String(document.createElementNS('http://www.w3.org/2000/svg', 'path').getTotalLength?.()),
)

console.log(lines.join('\n'))
