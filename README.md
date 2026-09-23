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


## Useful standalone parts of JSX6

If more parts of `jsx6` will make sense as standalone libs this section will be updated.

https://github.com/hrgdavor/jsx6/tree/main/libs/dom-observer

Performance for multiple ResizeObserver and IntersectionObserver can degrade if a new observer is created for each listener case, but some can be reused and it has become clear that It is better to reuse them instead of creating new for each observed element.

## About JSX in general 

https://hrgdavor.github.io/jsx6/demistify/ 

It is an interactive tutorial about JSX that is also a good introduction to this library.

The tutorial is also an experiment on how to present tutorial information in an interactive way. The format used there is not suitable for all chapters, so it has already yielded an insight regarding different types of explanations that need a different presentation format. This also brings the question how to intuitively switch between different formats if used inside a single tutorial.

## JSX in JSX6 and the reactive updates to DOM

After the general intro into `JSX` another tutorial is needed to continue on the topic to explain how to handle dynamic content(how it works in `JSX6`).

## Development / contribution

This is a **Bun** workspace monorepo (`workspaces` + `catalog:` in the root `package.json`). Rush and
pnpm are gone.

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
bun run check:fast   # faster subset: tests + JSDoc type check
bun run test         # tests only, discovered across every package
```

`bun run check` runs, in order: unit tests in **every** package that has them, declaration emit
(`tsc`), the `checkJs` type check, ESLint (including the custom `jsx6/signal-dependencies` rule),
the dependency-catalog check, and a package-manifest audit that dry-runs `npm pack` for every
publishable package. `scripts/publish.js` runs the gate itself and refuses to publish if it fails.

Make sure `bun run check` passes before `bun pub`. There is no CI; this command is the only gate.

# If you are doing SSR(Server side rendering) GTFO

Supporting SSR(Server Side Rendering) is actively ignored. Any compromises for using this lib combined with SSR are not welcome. 

This lib is strictly for JS APPLICATIOS that are not crawled by search engines. 

I do not want any ugly compromises to suport SSR (that I luckily never personally needed in my JavaScript apps).

# TSC troubleshooting

If `tsc` reports `This is not the tsc command you are looking for`, you are running the Windows
"Service Control" `tsc.exe` instead of TypeScript's CLI. In this repository always run TypeScript
through Bun, which resolves the workspace copy:

```bash
bun x tsc --noEmit -p libs/jsx6/tsconfig.json
```

The same applies to package scripts: declare `"tsc": "tsc"` in the package and run it with
`bun run tsc` (or `bun x tsc`), never by calling a globally installed `tsc` directly.
