/**
 * Runnable example: inspecting signals in the dev console.
 *
 * The `demo` region is what `doc/computed/usage.md` injects. Signals are functions, and a function
 * logged to the console shows nothing useful — the `value` getter is what makes expansion readable.
 */

import assert from 'node:assert/strict'
import { $C, signal } from '../../../index.js'

// #region demo
const $count = signal(1)

// The `value` getter is what tooling reads — a DevTools custom formatter, an inspector asked for hidden
// properties, Firefox's expanded view, or plain code like this:
$count.value // 1

// It is a getter, so it reports whatever the value is at the moment it is read:
$count(2)
$count.value // 2

// It works on computed signals too:
const $double = $C(() => $count() * 2)
$double.value // 4

// And it stays out of enumeration — `get` was already an enumerable key on every signal, `value` is not:
Object.keys($count) // ['get']
// #endregion demo

assert.equal($count.value, 2)
assert.equal($double.value, 4)
assert.deepEqual(Object.keys($count), ['get'])
assert.ok(!Object.keys($count).includes('value'))

// A logged signal keeps reporting the current value, because nothing was snapshotted at log time.
const logged = $count
$count(10)
assert.equal(logged.value, 10)
assert.equal(logged(), 10)
assert.equal($double.value, 20)
