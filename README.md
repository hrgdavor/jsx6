# JSX6  (apps only, no SSR, no web, no SEO).

For building SPA applications by leveraging JSX and signals. Not meant to hide or abstract the DOM, but actually have DOM smoothly integrated with the JS code.

- almost without a special requirements for bundler (Only needs support for JSX) 
- changes DOM precisely and reactively
- Implements signals as functions
- uses JavaScript Proxies for state(colelction of signals) 
- no need for special compiler for signals to work
- can be built by pure(full-speed no plugins) [esbuid](https://esbuild.github.io/)
- supports observables and promises out of the box 
- if there is a popular standalone signals lib will consider integrating 

## Getting started

The instruction set for the base stack — setup (esbuild/tsconfig/JSX config), the signal model, JSX and
the DOM contract, and the rules that fail silently — is [docs/stack/README.md](docs/stack/README.md). It
is written for people and for agents, and every sample in it is either injected from a real file or a
runnable example.

Building a host on the editor: [apps/nodditor/doc/getting-started.md](apps/nodditor/doc/getting-started.md).
Add-ons: [libs/dom-observer/doc/README.md](libs/dom-observer/doc/README.md) (shared observers) and the
[API map](docs/api.md). 


## Useful standalone parts of JSX6

If more parts of `jsx6` will make sense as standalone libs this section will be updated.

https://github.com/hrgdavor/jsx6/tree/main/libs/dom-observer

Performance for multiple ResizeObserver and IntersectionObserver can degrade if a new observer is created for each listener case, but some can be reused and it has become clear that It is better to reuse them instead of creating new for each observed element.

### Signal implementations

Two interchangeable cores, released together (lockstep), so a project can switch between them:

* [`@jsx6/signal`](libs/signal/README.md) — the default. Eager, immediate propagation, plus `$C`
  (lazy computed), `$CE` (eager computed), `batch()` and `dispose()`. **No dependencies.**
* [`@jsx6/signal-alien`](libs/signal-alien/README.md) — the same contract implemented on
  [alien-signals](https://github.com/stackblitz/alien-signals), for projects that want alien's graph
  itself, plus two-way interop between alien nodes and jsx6 signals. Drop-in replacement, ~2 kB gzip
  larger, one runtime dependency.

How they were chosen, and what each costs, is measured and recorded in
[experiments/signal-directions](experiments/signal-directions/README.md).

## About JSX in general 

https://hrgdavor.github.io/jsx6/demistify/ 

It is an interactive tutorial about JSX that is also a good introduction to this library.

The tutorial is also an experiment on how to present tutorial information in an interactive way. The format used there is not suitable for all chapters, so it has already yielded an insight regarding different types of explanations that need a different presentation format. This also brings the question how to intuitively switch between different formats if used inside a single tutorial.

## JSX in JSX6 and the reactive updates to DOM

After the general intro into `JSX` another tutorial is needed to continue on the topic to explain how to handle dynamic content(how it works in `JSX6`).

## Development / contribution

This is a **Bun** workspace monorepo (`workspaces` + `catalog:` in the root `package.json`). Rush and
pnpm are gone. Bun **1.3.14 or newer** is required — see [`README.dev.md`](README.dev.md) for the
toolchain details and the Rush-to-Bun command translation.

Prerequisites:
- [Bun](https://bun.sh/) (the workspace/install/test runner)

After cloning the repository:

```bash
bun install
```

### There is no CI — `bun run check` is the gate

This project deliberately has **no continuous integration**, no build server and no remote gate of
any kind (see `plan/improvement-plan.md` decision D1). Everything is verified locally, so the local
gate is the only thing standing between a mistake and a published package:

```bash
bun run check        # the full local gate — must pass before committing and before `bun pub`
bun run check:fast   # faster subset: tests + `bun check` for every lib (no tsc, no bundling)
bun run test         # tests only, discovered across every package
```

`bun run check` runs, in order: unit tests in **every** package that has them, an assertion that the
declaration emitter really is TypeScript 7.x, declaration emit (`tsc` — the only job `tsc` still has
here), the `checkJs` type check (`bun check`), Oxlint (including the custom
`jsx6/signal-dependencies` rule), Oxfmt, the dependency-catalog check, the docs-sync check, and a
package-manifest audit that dry-runs `npm pack` for every publishable package. `scripts/publish.js`
runs the gate itself and refuses to publish if it fails.

Type checking is Bun's own checker: `bun check`, run **inside** a package (at the repository root
that name is this gate script, so `bun check` there runs the gate). `bun check` never writes files,
which is why `tsc` is still around to emit the declarations.

Make sure `bun run check` passes before `bun pub`. There is no CI; this command is the only gate.

# If you are doing SSR(Server side rendering) GTFO

Supporting SSR(Server Side Rendering) is actively ignored. Any compromises for using this lib combined with SSR are not welcome. 

This lib is strictly for JS APPLICATIOS that are not crawled by search engines. 

I do not want any ugly compromises to suport SSR (that I luckily never personally needed in my JavaScript apps).

# TSC troubleshooting

`tsc` has exactly one job left in this repository: emitting the `dist/*.d.ts` declarations. Type
*checking* is `bun check` and never involves `tsc`.

If `tsc` reports `This is not the tsc command you are looking for`, you are running the Windows
"Service Control" `tsc.exe` instead of TypeScript's CLI. In this repository always run TypeScript
through Bun, which resolves the workspace copy:

```bash
bun check                                 # inside a package: the type check (no tsc involved)
bun run types                             # inside a package: declaration emit
bun x tsc -p libs/jsx6/tsconfig.json      # the same emit, from the repository root
```

The same applies to package scripts: the declaration emitter is declared as `"types": "tsc"` and run
with `bun run types` (or `bun x tsc`), never by calling a globally installed `tsc` directly. The
version is pinned to TypeScript 7.x in the root `catalog`, and the gate fails if the installed
`tsc` is not 7.x.
