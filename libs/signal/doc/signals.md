# Signals

## Background

As far as I am aware, at the time of writing this document, `signals ` are a popular concept but there is no formal definition. Much like REST at the beginning, there is an understanding what the term is and what it provides. There is not a standard yet, and if no official standard will ever be provided, hopefully there will be a convergence in implementations to something that is like a standard way of implementing/using signals.

Problems that `signals ` are aiming to solve  are not totally new, there were different approaches to solve the same problems in the past. When talking about GUI, it is THE problem to solve: *how to reflect changes in the interface in a reliable way that is also easy to use as a developer*. You could say it is about reactivity, or reactive programming. `Signals ` implementation here my sound similar to RxJS in some aspects.

RxJS rant:  *for me RxJS is absolutely awful to use and I hate reading other people's RxJS code. Maybe Angular is the reason it feels so awful to use. Maybe, on it's own, it is actually ok.*

## `$` prefix

Using `$` prefix is intentional to visually mark those variables as something special, to make it less error prone in usage. It is likely similar reason why observables use it as suffix in RxJS (it is even enforced by compiler in some setups).

## Composition using auto-magic VS manual

Just to compare the syntax, let us imagine we have two signals with numbers `$a,$b` and we want to write a `$sum` signal:

```js
// automagic is more readable
const $sum = $S(()=>$a() + $b())

// manual composition is less readable and similar to printf
const $sum = $S((a,b)=>a + b, $a, $b)
// more readable alternative is with template func declared separately
const sum = (a,b)=>a + b // this is also nice for reusability
const $sum = $S(sum, $a, $b)
```

**Manual** composition is easier to implement and arguably easier to reason about. It will be the initial implementation (and likely the only one here).

**Manual** composition usage is very similar to `printf` in regard that firs parameter is a template to produce a value (in this case, the template is a function) and rest parameters are the signals that are used by that function to produce new value. 

**Manual composer** function (in our case `$S`) only needs to:

- create a new signal
- take initial value of all dependent signals
- pass the values to template function to produce the derived value
- listen for changes on all dependent signals and produce new derived value on change

**Auto-magic composer** needs to setup a trap, then call the function and catch access to any signal during the call, and subscribe to changes. This may sound simple to implement to some developers, but I personally imagine it being difficult to implement well, and also debug if something goes wrong. 

**Auto-magic compiled** can be done better using compiler like Svelte, or babel/SWC plugin, but I am strictly avoiding compiler customizations in favour of compile speed delivered for for example by `esbuild`. A compromise could be made to create a SWC plugin that can convert some nicer syntax to above mentioned manual syntax. In that case I would still prefer to limit processing only to some files (example: `*.signals.js`) to only do slow compiling those files. It could be the case SWC is speedy enough to not notice a difference from esbuild, then a SWC plugin to convert code would be a nice benefit without a noticeable downside.