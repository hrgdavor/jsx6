/**
 * Source for the signal-inspection demo page.
 *
 * Bundled by `serve.js` into `dist/demo.js`, loaded as a module by `index.html`.
 *
 * The point of the page: give the dev console a set of **real** signals to expand, one of every shape
 * the library has, on both shipped cores, and buttons that demonstrate the parts of the inspection
 * contract that are easy to get wrong (a getter rather than a snapshot, non-enumerability, a proxy
 * state, a constant wrapper, a lazy computed that only evaluates when somebody looks).
 *
 * Everything interesting is parked on `window` on purpose: the user is going to type at it.
 */

import * as coreSignal from '@jsx6/signal'
import * as coreAlien from '@jsx6/signal-alien'

const CORES = {
  signal: coreSignal,
  alien: coreAlien,
}

const els = {
  tbody: document.querySelector('#values tbody'),
  note: document.querySelector('#core-note'),
  buttons: {
    signal: document.querySelector('#core-signal'),
    alien: document.querySelector('#core-alien'),
  },
}

/** The demo state for the active core. Rebuilt whenever the core changes. */
let active = null

/** A duck-typed signal: the shape `@jsx6/jsx6` uses for translations — no getter of ours to hook. */
function makeDuckTypedSignal(initial) {
  let value = initial
  const listeners = new Set()
  const $duck = () => value
  $duck[coreSignal.subscribeSymbol] = cb => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }
  $duck.set = v => {
    value = v
    listeners.forEach(cb => cb())
  }
  return $duck
}

function build(coreName) {
  const core = CORES[coreName]

  // --- plain signal -------------------------------------------------------------------------------
  const $count = core.signal(1)

  // --- base signal, deliberately NOT declared as a dependency of $sum ----------------------------
  const $base = core.signal(100)

  // --- lazy computed: no dependency list, evaluated on the first read ----------------------------
  let doubleRuns = 0
  const $double = core.$C(() => {
    doubleRuns++
    return $count() * 2
  })

  // --- eager computed: up to date whether or not anybody reads it --------------------------------
  const $eager = core.$CE(() => $count() * 10)

  // --- derived with an omitted dependency (union dependencies track it anyway) -------------------
  const $sum = core.$S(() => $count() + $base(), $count)

  // --- value-returning derived -------------------------------------------------------------------
  const $label = core.$F((count, base) => `count=${count} base=${base}`, $count, $base)

  // --- state: a proxy with lazily created child signals ------------------------------------------
  const $user = core.$State({ name: 'Ada', age: 36 })

  // --- constant wrapper: deliberately no `value` getter -----------------------------------------
  const $static = core.staticSignal(3)

  // --- duck-typed signal: has the protocol, never the getter ------------------------------------
  const $duck = makeDuckTypedSignal('standard')

  const signals = { $count, $base, $double, $eager, $sum, $label, $user, $static, $duck }

  // --- the page's live table, rendered with observeNow -------------------------------------------
  // Each row binds the *signal itself*: `observeNow` only observes things that carry the signal protocol
// — a plain `() => $count()` arrow is a static value to it (the "any function prop is a signal" rule
// lives in jsx6's DOM layer, not in the signal core), and the callback would receive the arrow.
  const rows = [
    ['$count', 'signal(1)', $count],
    ['$base', 'signal(100)', $base],
    ['$double', 'lazy $C — evaluates on read', $double],
    ['$eager', 'eager $CE', $eager],
    ['$sum', '$S(() => $count() + $base(), $count) — $base omitted', $sum],
    ['$label', '$F((c, b) => …)', $label],
    ['$user.name', '$State child', $user.name],
    ['$user', '$State proxy — the snapshot as JSON', $user],
    ['$static', 'staticSignal(3) — no `value`', $static],
    ['$duck', 'duck-typed — no `value`', $duck],
  ]

  const unsubscribes = []
  els.tbody.textContent = ''
  for (const [name, kind, target] of rows) {
    const tr = document.createElement('tr')
    const tdName = document.createElement('td')
    tdName.className = 'name'
    tdName.textContent = name
    const tdKind = document.createElement('td')
    tdKind.className = 'muted'
    tdKind.textContent = kind
    const tdVal = document.createElement('td')
    tdVal.className = 'val'
    tr.append(tdName, tdKind, tdVal)
    els.tbody.append(tr)

    // One binding per row: the library updates the cell synchronously on every change, so the table is
    // also a check that the values really are reactive.
    unsubscribes.push(core.observeNow(target, v => (tdVal.textContent = String(v))))
  }

  return {
    core,
    coreName,
    signals,
    holds: { $count, $base, $double, $eager, $sum, $label, $user, $static, $duck },
    unsubscribes,
    doubleRunsRef: () => doubleRuns,
    dispose() {
      // A binding can legitimately have nothing to unsubscribe: `observeNow` returns undefined for a
      // static value, for a Promise/Observable, and for a `staticSignal` (whose subscribe is a no-op).
      // `jsx6`'s own `addDisposer` takes `Function|undefined` for the same reason.
      for (const un of unsubscribes) if (typeof un === 'function') un()
    },
  }
}

/**
 * Logs the demo signals **as they are** — no wrappers, just `console.log($sig)`.
 *
 * Because console interception is installed, each entry arrives as a described object with the value in
 * it; with the interception toggled off, the very same lines show the function a signal is.
 */
function logSignals(reason = 'loaded') {
  const { coreName, holds } = active
  console.group(`%c signal inspection demo — ${coreName} (${reason}) `, 'background:#0a7;color:#fff')
  console.log('--- the signals themselves (log these exact objects in your own code) ---')
  const entries = [
    ['1. a plain signal', holds.$count],
    ['2. a lazy computed ($C)', holds.$double],
    ['3. an eager computed ($CE)', holds.$eager],
    ['4. $S with an omitted dependency ($base)', holds.$sum],
    ['5. $F returning a formatted value', holds.$label],
    ['6. a $State proxy', holds.$user],
    ['7. a staticSignal', holds.$static],
    ['8. a duck-typed signal', holds.$duck],
  ]
  for (const [label, sig] of entries) console.log(`${label}:`, sig)
  console.log('--- and the values, which need no mechanism at all ---')
  for (const [label, sig] of entries) {
    const { value, error } = coreSignal.readSignal(sig)
    console.log(`   ${label.padEnd(45)} value = ${error ? `⚠ ${error}` : String(value)}   (via $sig.value)`)
  }
  console.log(
    '   without console interception the lines above show function source in Chrome; the values below' +
      '\n   them are why `console.log($count.value)` always works.' +
      '\n   also worth trying: core.signal(5), core.$C(() => $count() * 100), demo.describe($sum)',
  )
  console.groupEnd()
}

function activate(coreName) {
  active?.dispose()
  active = build(coreName)

  for (const [name, button] of Object.entries(els.buttons)) {
    button.setAttribute('aria-pressed', String(name === coreName))
  }
  const other = coreName === 'signal' ? 'alien' : 'signal'
  els.note.textContent = `both cores are loaded; switch to ${CORES[other].meta?.id ?? other}`

  window.core = active.core
  window.cores = CORES
  window.signals = active.holds
  window.$count = active.holds.$count
  window.$base = active.holds.$base
  window.$double = active.holds.$double
  window.$eager = active.holds.$eager
  window.$sum = active.holds.$sum
  window.$label = active.holds.$label
  window.$user = active.holds.$user
  window.$static = active.holds.$static
  window.$duck = active.holds.$duck

  logSignals('active core')
}

// ------------------------------------------------------------------------------------------------
// buttons
// ------------------------------------------------------------------------------------------------

let writes = 0
document.querySelector('#write').addEventListener('click', () => {
  writes++
  active.holds.$count(writes)
  active.holds.$base(100 + writes)
  active.holds.$duck.set(writes % 2 ? 'express' : 'standard')
  console.log(
    `wrote $count(${writes}) and $base(${100 + writes}) — expand the earlier entries. ` +
      `$double is lazy, so it has only evaluated ${active.doubleRunsRef()} time(s) so far (writes mark it ` +
      `dirty, reads do the work); $eager is always current.`,
  )
})

document.querySelector('#log').addEventListener('click', () => {
  const $count = active.holds.$count
  console.log(`LOGGED NOW at $count = ${$count()} — the text is frozen; the signal below is the signal:`, $count)
  console.log('  …and the value at the moment you expand it, via the getter:', { value: $count.value, read: () => $count() })
})

document.querySelector('#facts').addEventListener('click', () => {
  const $count = active.holds.$count
  const $double = active.holds.$double
  console.log('enumeration facts', {
    signalKeys: Object.keys($count),
    valueIsEnumerable: Object.getOwnPropertyDescriptor($count, 'value').enumerable,
    valueIsGetter: typeof Object.getOwnPropertyDescriptor($count, 'value').get === 'function',
    spreadSignal: { ...$count },
    jsonOfSignal: JSON.stringify({ $count }),
    jsonOfComputed: JSON.stringify({ $double }),
    hasValueInOperator: 'value' in $count,
    staticSignalKeys: Object.keys(active.holds.$static),
    staticHasValue: 'value' in active.holds.$static,
  })
  console.log(
    'the same, printed as signals rather than as plain objects — a function serialises to nothing:',
    { signalAsValue: $count, computedAsValue: $double },
  )
  console.log(
    '…which is why a signal needs the console interception to be readable, while `$count.value` always is.',
  )
})

document.querySelector('#logs').addEventListener('click', () => logSignals('re-logged'))

document.querySelector('#console').addEventListener('click', () => {
  if (coreSignal.hasConsoleInspection()) {
    coreSignal.uninstallConsoleInspection()
    console.log('console interception OFF — signals now log as the functions they are:')
  } else {
    console.log('console interception ON — the next logs describe signal arguments:')
    coreSignal.installConsoleInspection({ showCallSite: true })
  }
  console.log('  signal:', active.holds.$count, '| computed:', active.holds.$double)
})

document.querySelector('#cyclic').addEventListener('click', () => {
  const core = active.core
  let $cyclic
  $cyclic = core.$C(() => ($cyclic ? $cyclic() : 0) + 1)
  window.$cyclic = $cyclic
  console.log('created window.$cyclic — a computed that reads itself. Read it (or expand it):', $cyclic)
  console.log('  its value:', $cyclic.value, '— and the cycle report above appeared once')
})

document.querySelector('#dispose').addEventListener('click', () => {
  const $double = active.holds.$double
  active.core.dispose($double)
  console.log('disposed $double — the next read recomputes from scratch and re-subscribes:', $double.value)
})

document.querySelector('#alienNode').addEventListener('click', () => {
  const core = active.core
  if (!core.alien) {
    console.log('this core has no alien interop: expand $count instead')
    return
  }
  const a = core.alien.signal(1)
  const alienComputed = core.alien.computed(() => a() * 7)
  window.$alienNode = a
  window.$alienComputed = alienComputed
  console.log('an alien node and an alien computed — no `value`, they are not jsx6 signals:', a, alienComputed)
  console.log('bridged into jsx6 by the compat layer:', core.toSignal(a), core.toSignal(alienComputed))
})

for (const [name, button] of Object.entries(els.buttons)) {
  button.addEventListener('click', () => activate(name))
}

// ------------------------------------------------------------------------------------------------
// start
// ------------------------------------------------------------------------------------------------

window.demo = {
  activate,
  logSignals,
  describe: coreSignal.describeSignal,
  inspect: coreSignal.describeSignal,
  label: coreSignal.signalLabel,
  installConsoleInspection: coreSignal.installConsoleInspection,
  uninstallConsoleInspection: coreSignal.uninstallConsoleInspection,
  hasConsoleInspection: coreSignal.hasConsoleInspection,
  get active() {
    return active
  },
}

// Console interception: `console.log($count)` — written exactly like that, with no wrapper and no DevTools
// setting — then shows a described object with the value. Opt-in, as it patches global console methods;
// see src/debug.js. The proxy/formatter experiments that used to live here were measured at ~13x on reads
// and removed — `changes.md` keeps the numbers.
coreSignal.installConsoleInspection({ showCallSite: true })

activate('signal')
console.log(
  '%c signal inspection demo ready ',
  'background:#0a7;color:#fff',
  '\nconsole.log($count) now shows {signal, kind, value, read, raw} — console interception, so the call' +
    ' site is unchanged and no DevTools setting is needed.' +
    '\nPress "toggle console inspection" to see the same lines as the function a signal is.' +
    '\nTry: $count, $double, $count.value, $count(), demo.describe($sum), demo.activate("alien")',
)