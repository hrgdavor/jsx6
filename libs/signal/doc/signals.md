# Signals

## Background

As far as I am aware, at the time of writing this document, `signals ` are a popular concept but there is no formal definition. Much like REST at the beginning, there is an understanding what the term is and what it provides. There is not a standard yet, and if no official standard will ever be provided, hopefully there will be a convergence in implementations to something that is like a standard way of implementing/using signals.

Problems that `signals ` are aiming to solve  are not totally new, there were different approaches to solve the same problems in the past. When talking about GUI, it is THE problem to solve: *how to reflect changes in the interface in a reliable way that is also easy to use as a developer*. You could say it is about reactivity, or reactive programming. `Signals ` implementation here my sound similar to RxJS in some aspects.

**RxJS rant:**  *for me RxJS is absolutely awful to use and I hate reading other people's RxJS code. Maybe Angular is the reason it feels so awful to use. Maybe, on it's own, it is actually ok.*

## `$` prefix

Using `$` prefix is intentional to visually mark those variables as something special, to make it less error prone in usage. It is likely similar reason why observables use it as suffix in RxJS (it is even enforced by compiler in some setups).

## Composition using auto-magic VS manual

Just to compare the syntax, let us imagine we have two signals with numbers `$a,$b` and we want to write a `$sum` signal:

```js
// manual composition is less readable and similar to printf
// manual $S will call the function and you need to read signal values in the expression
const $sum = $S(()=>$a() + $b(), $a, $b)

// manual $F will call the function with signal values
const $sum = $F((a, b)=>a + b, $a, $b)
// more readable alternative is with filter func declared separately
const sum = (a,b)=>a + b // this is also nice for reusability
const $sum = $F(sum, $a, $b)

// automagic: dependencies are tracked during execution, no list needed
const $sum = $C(()=>$a() + $b())      // lazy and memoized
const $sumEager = $CE(()=>$a() + $b()) // same, but recomputes on every change
```

**Manual** composition is easier to implement and arguably easier to reason about, and it was the initial
implementation. **Automatic** tracking was added later (`$C`/`$CE`, see `src/track.js` and
`src/computed.js`) and is opt-in: `$S`/`$F` keep their manual dependency lists *and* honour tracked reads,
so the effective dependency set is the union of both. That makes an omitted dependency harmless rather
than silently wrong, while every previously working call site behaves exactly as before.

Automatic tracking only covers this library's own signals, because it works by recording reads inside the
signal getter. A duck-typed fake signal, a Promise or an Observable cannot be tracked that way and still
needs to be declared.

The whole effort — usage, how dependencies are found, the implementation internals, and the change
record with its measurements — is documented in [`computed/`](computed/README.md).

**Auto-magic compiled** can be done better using compiler like Svelte, or babel/SWC plugin, but I am strictly avoiding compiler customizations in favour of compile speed delivered for example by `esbuild` that does not support transforming the code. A compromise could be made to create a SWC plugin that can convert some nicer syntax to above mentioned manual syntax. In that case I would still prefer to limit processing only to some files (example: `*.signals.js`) to only do slow compiling those files. It could be the case SWC is speedy enough to not notice a difference from esbuild, then a SWC plugin to convert code would be a nice benefit without a noticeable downside.