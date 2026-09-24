/**
 * Runnable example: computed signals over `$State`.
 *
 * `$State` exposes each property as a signal plus the whole object as an aggregate signal; a computed
 * can depend on either, and the aggregate is what makes a multi-property update settle once.
 */

import assert from 'node:assert/strict'
import { $C, $S, $State, mergeValue, observe } from '../../../index.js'

// #region demo
const $user = $State({ firstName: 'John', lastName: 'Doe' })

// Depend on two children.
const $fullName = $C(() => `${$user.firstName()} ${$user.lastName()}`)

// Or on the whole state, which fires once for any change to it.
const $initials = $C(() => ($user().firstName[0] ?? '') + ($user().lastName[0] ?? ''))

assert.equal($fullName(), 'John Doe')
assert.equal($initials(), 'JD')

mergeValue($user, { firstName: 'Jane', lastName: 'Smith' })
assert.equal($fullName(), 'Jane Smith')
// #endregion demo

assert.equal($initials(), 'JS')

// One derived signal, one notification, for a merge that touched two properties.
const $label = $S(() => `${$user.firstName()} ${$user.lastName()}`, $user)
let notifications = 0
observe($label, () => notifications++)

mergeValue($user, { firstName: 'Ada', lastName: 'Lovelace' })
assert.equal(notifications, 1)
assert.equal($label(), 'Ada Lovelace')

// Setting a property to undefined resets it, and a computed sees the new shape.
$user.lastName = undefined
assert.equal($fullName(), 'Ada undefined')
