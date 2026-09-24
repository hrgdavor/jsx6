/**
 * Verify the *actual* recomputation/notification contract of the current implementation:
 *
 *   - `createDerivedSignal` runs `updater = () => $signal(getValue())` on every dependency change
 *   - `prepareSignal.setValue` does `if (v === value) return` (no fire) otherwise fires listeners
 *
 * Therefore: recomputation is unconditional, notification is value-guarded.
 */
import { observe, signal, $S, $State } from '@jsx6/signal'

const log = []
const out = (...a) => log.push(a.join(' '))

// 1 — same computed value: updater runs, listeners must NOT fire
{
  const $a = signal(1)
  let runs = 0
  let fired = 0
  // parity: stays 1 for a=1 and a=3
  const $parity = $S(() => {
    runs++
    return $a() % 2
  }, $a)
  observe($parity, () => fired++)
  const beforeRuns = runs
  $a(3) // 3 % 2 === 1 === current value
  out(`1. same value:    recomputes=${runs - beforeRuns} notifies=${fired} value=${$parity()}`)
}

// 2 — changed computed value: updater runs AND listeners fire
{
  const $a = signal(1)
  let runs = 0
  let fired = 0
  const $double = $S(() => {
    runs++
    return $a() * 2
  }, $a)
  observe($double, () => fired++)
  const beforeRuns = runs
  $a(2)
  out(`2. changed value:  recomputes=${runs - beforeRuns} notifies=${fired} value=${$double()}`)
}

// 3 — child-signal deps + two writes: is an intermediate value observable?
{
  const $s = $State({ x: 1, y: 10 })
  const $sum = $S(() => $s.x() + $s.y(), $s.x, $s.y) // both CHILDREN as deps
  const seen = []
  observe($sum, () => seen.push($sum()))
  $s.x = 2
  $s.y = 20
  out(
    `3. child deps:     notifications=${JSON.stringify(seen)} (intermediate visible if length>1 with unequal values)`,
  )
}

// 4 — same but with the aggregate dep (what the repo's own tests use)
{
  const $s = $State({ x: 1, y: 10 })
  const $sum = $S(() => $s.x() + $s.y(), $s) // aggregate dep
  const seen = []
  observe($sum, () => seen.push($sum()))
  $s.x = 2
  $s.y = 20
  out(`4. aggregate dep:  notifications=${JSON.stringify(seen)}`)
}

// 5 — child deps inside one batched $State update (mergeValue)
{
  const $s = $State({ x: 1, y: 10 })
  const $sum = $S(() => $s.x() + $s.y(), $s.x, $s.y)
  const seen = []
  observe($sum, () => seen.push($sum()))
  // mergeValue writes both keys; the aggregate is batched but child deps are not
  $s({ x: 5, y: 50 })
  out(`5. set({x,y}):     notifications=${JSON.stringify(seen)}`)
}

// 6 — does the derived memoize WORK when the value is unchanged? (runs counter above says no)
{
  const $s = $State({ firstName: 'John', lastName: 'Doe' })
  let runs = 0
  const $full = $S(() => {
    runs++
    return `${$s.firstName()} ${$s.lastName()}`
  }, $s)
  const seen = []
  observe($full, () => seen.push($full()))
  const before = runs
  $s.firstName = 'John' // same value -> no child change at all
  $s.lastName = 'Doe'
  out(`6. same writes:    recomputes=${runs - before} notifications=${JSON.stringify(seen)}`)
}

console.log(log.join('\n'))
