# `jsxed` — live JSX6 component editor (CodeMirror + LSP)

**Created:** 2026-10-21
**Status:** proposal, pre-code. The first six questions, plus the live-buffer/host/refresh questions
Q14/Q15/Q17/Q21/Q22/Q23, were answered on 2026-10-21; those answers are recorded in §7.1 and folded into
the architecture below.

**Scope:** a new app, `apps/jsxed` (`@jsx6/jsxed`), built with `@jsx6/jsx6`. Existing packages are not
modified in P0/P1 except for additive type declarations and small shared helpers.
**Related:** [apps/repl](../apps/repl) (live runner + Monaco), [libs/jsx-dev-runtime](../libs/jsx-dev-runtime)
(`_source` and the JSX inspector), [libs/jsx6](../libs/jsx6), [libs/w](../libs/w),
[docs/stack/components.md](../docs/stack/components.md), [improvement-plan.md](./improvement-plan.md),
[jcodebuddy webview](../../java/jcodebuddy/webview/README.md) (host-editor bridge).

**At a glance (post-answers):**

- v1 is a single-file `main.jsx` scratchpad: CodeMirror editor, live iframe preview, source↔DOM sync.
- Preview transform runs on a local Bun server with esbuild (`jsxDev`), producing a self-contained bundle.
- **The webview-owned standalone editing backend is the first hard requirement.** Editing must work
  through it before any LSP work; it is not optional polish.
- Completion starts with CodeMirror/JSX6 fallback providers. LSP/TypeScript autocomplete is deferred to
  the **last phase**, with only the transport/document-sync interfaces scaffolded in advance.
- TypeScript never compiles or checks jsxed source and is not an app code dependency.
- Structure, Layout and Focus modes come after the source↔DOM index is trustworthy.
- jsxed can also run as a **guest of a jcodebuddy webview host**: the host editor owns the file, and jsxed
  uses the webview `open`/`read`/`edit` contract instead of requiring its internal editor.
- Live unsaved host text has **two planned channels** — a host buffer-read capability and LSP
  `didChange` — with only one active `liveSource` at a time.
- The standalone **IDE half** (host core: HTTP/auth/port/conformance) is webview-owned; jsxed supplies only
  an `EditorHost` adapter when a webview page needs to open/edit in jsxed.
- Far future: live application template/CSS editing, scaffolded now via file-aware provenance and a
  read-only CSS index; template edits come before module HMR.
- Fast refresh is a first-class part of the design: a service worker caches vendor libraries immutably,
  app code and CSS update without a full reload, and routing/state restoration makes a reload as fast as
  HMR. A full reload happens only when the vendor/library version changes.
- The app stays private; the dogfood target is S2; a static/browser-only mode is a later goal.

---

## 1. The brief, distilled

Build a new app, **jsxed**, that is a live editor for JSX6 components:

- **Code editor:** CodeMirror 6, not Monaco. CodeMirror is smaller and gives finer control over showing,
  hiding, freezing and annotating parts of the code.
- **Language intelligence:** LSP integration, with completions that match what Monaco gives today and
  then go beyond it.
- **Visual understanding:** viewing modes that make a component and its parts easy to perceive — layout
  parts, subcomponents, and the DOM elements they produce.
- **UI stack:** the app itself is built with JSX6. The long-term goal is to develop jsxed *with* jsxed.
- **Language policy:** JS + JSDoc, never TypeScript source and never a TS→JS transform. TypeScript exists
  only as editor tooling. Accompanying `.d.ts` files are welcome because they do not affect bundling.
- **Completion strategy:** the hard part is reaching Monaco-quality completion; the opportunity is to
  exceed it by knowing JSX6's runtime and component model.

Two ideas drive the design:

1. **The source is the truth; every view is a projection of it.** Visual modes must not become a second
   editable model that drifts from the code.
2. **JSX6 is the advantage.** Monaco can know TypeScript; jsxed can also know `define()`, `tpl()`, `p`
   scopes, signals, directives and the actually rendered DOM.

### 1.1 Tensions the plan has to resolve

| tension                                  | why it matters |
| ---------------------------------------- | -------------- |
| CodeMirror freedom vs completion quality | Hiding/freezing code is local and cheap; semantic completion needs a real language service. They pull in different directions. |
| Server-assisted vs portable              | Server-side transform is fast and bundles imports, but adds a local process; a browser-only mode needs a wasm/worker substitute and a non-TS completion fallback. |
| Rich views vs source fidelity            | Every decoration, fold, freeze and overlay has to map back to exact source ranges, including loops and shadow DOM. |
| JS-only policy vs typed completions      | d.ts is allowed, but JSX6 has no JSX namespace yet, so "Monaco quality" first requires a JSX6 type surface. |
| Dogfooding vs bootstrap                  | S2 (editing jsxed's own components) is practical; full self-host (S4) needs a browser-side bundler/loader and is a separate project. |

## 2. Goals

### 2.1 Product goals

| ID      | goal                                                                              | done when (v1) |
| ------- | --------------------------------------------------------------------------------- | -------------- |
| **G1**  | **Tight live loop.** Edit JSX6 and see the rendered result without a page reload. | A sample component rerenders after a debounce; syntax and runtime errors are shown with a source location; no reload; p95 rerender target < 500 ms (provisional). |
| **G2**  | **Two-way source ↔ DOM navigation.**                                              | Caret/selection in the editor highlights the matching DOM element(s); an inspect gesture on the preview selects the matching source range. Works for function components, `JsxW` components, fragments, loops and shadow roots, with documented one-to-many behaviour. |
| **G3**  | **Viewing modes for structure and layout.**                                       | At least four modes: Code, Structure, Layout, Focus. Each answers a stated question and can be toggled with the keyboard; mode state survives reload. |
| **G4**  | **Completion parity, then advantage — last phase.**                               | **Not a v1 gate.** With a usable TypeScript LSP (TS 7 sidecar/worker), expected semantic items on a fixed JSX6 corpus appear in the top suggestions at least as often as the Monaco/TS baseline; p95 completion latency < 150 ms (provisional). Before P5, completion is the CodeMirror/JSX6 fallback. |
| **G5**  | **JSX6-native UI and a real dogfood path.**                                       | All app chrome is JSX6; no React, no Monaco in the product. At least one real jsxed component is developed in jsxed by the end of P4. |
| **G6**  | **Local-first, server-assisted, embeddable.**                                     | v1 runs from a local Bun server that transforms preview code and proxies the LSP sidecar. It works standalone or as an IDE webview guest; the editor stays usable when the server or host is down; a browser-only/static mode is a later goal, not a v1 gate. |
| **G7**  | **Fit the repository.**                                                           | JS + JSDoc + optional d.ts; no TS source; no SSR; no CI; app builds and tests locally; the root gate still passes. |
| **G8**  | **Predictable weight.**                                                           | Heavy assets (sidecar, transform server) are measured and started lazily. Initial interactive shell target < 1.5 s on a warm cache; editor shell JS target < 600 KB gzip (both provisional until P0 measures). |
| **G9**  | **Cooperate with host editors.**                                                  | jsxed can run inside a jcodebuddy webview host (JetBrains, VS Code, Eclipse, or a standalone host): open a location in the host editor, read the project file, propose/apply edits into the host buffer, and react to host file-change events. Live unsaved text arrives via the active `liveSource` (host buffer-read or LSP `didChange`). The internal CodeMirror remains usable when no host is present. |
| **G10** | **Fast refresh without module HMR.**                                              | Warm reload restores editor/view/session state and does not re-fetch vendor libraries; app code/CSS updates refresh the shell or preview without a full page reload; a full reload happens only when the vendor/library version hash changes. Targets: warm reload < 150 ms to interactive, library bytes downloaded on app-only update = 0, preview refresh < 300 ms (provisional, measured in P0/P1). |
| **G11** | **Standalone editing backend.**                                                   | The webview-owned standalone backend + jsxed `EditorHost` adapter can open, read, diff/apply-edit and watch a project document, with no IDE and no LSP. This is the hard prerequisite for smooth editing and lands before any language-service work. |

### 2.2 Engineering principles

- **Source is truth.** Views are read-only projections. A view may hide, dim, fold or freeze code, but it
  never rewrites source except through an explicit refactor/code action.
- **Graceful degradation.** If the language service, a worker or an iframe fails, the editor still edits
  and the preview still runs; completion falls back to the CodeMirror/JSX6 providers.
- **Lazy and isolated.** The sidecar, the optional worker and the preview runtime are separate
  processes/realms. Typing must never wait on either.
- **Reuse proven assets.** `@jsx6/jsx-dev-runtime` already attaches `_source` to DOM nodes; `apps/repl` has
  a working double-buffered iframe and a `preventInfiniteLoops` idea. Reuse before inventing.
- **Evidence over claims.** "As good as Monaco" is a measured comparison, not a design intention. Keep a
  corpus and a benchmark from P1 onward.

### 2.3 Non-goals for v1

- A general IDE: no project graph, package installation, git, terminal, debugger or multi-user editing.
- TypeScript source or type stripping. No `tsx`/`ts` inputs.
- SSR/prerender/hydration (already a project-wide decision).
- Replacing `apps/repl` or `apps/nodditor`. jsxed is a focused component editor.
- Arbitrary import resolution from npm/CDN, multi-file workspaces, or a full VSCode-compatible LSP client
  surface (rename across files, workspace symbols, call hierarchy, …).
- A static, backend-free build in v1. The chosen transform path is server-side; a static mode can be added
  later without changing the editor-facing API.
- Running untrusted third-party code as a public multi-tenant service. The preview executes the user's own
  code; see §7 Q10 and §8.
- Installing or starting an IDE host/plugin. jsxed uses an existing jcodebuddy webview host when one is
  available; otherwise it stays standalone.
- Module-level HMR, hot boundaries, module-graph invalidation or state-preserving module replacement.
  **Fast refresh is in scope** via service-worker caching + state restoration; template/CSS edits can
  refresh the preview without a shell reload.
- Full application live editing or CSS editing in v1. Only the file-aware provenance and a read-only CSS
  index are scaffolded now.
- Mobile/touch-first interaction.

### 2.4 Priority order

The hard requirement is the **standalone editing backend**, not autocomplete:

1. **Standalone editing backend** — webview-owned host core + jsxed `EditorHost` adapter; open/read/edit/
   watch; this is what makes editing work without an IDE.
2. **Fast refresh + state restoration** — service worker, routing, session restore; UX/performance.
3. **Visual editing foundation** — source↔DOM, structure/layout/focus modes.
4. **JSX6 intelligence** — runtime-aware diagnostics/completions that do not require TypeScript.
5. **Dogfood/packaging** — after the editing loop is solid.
6. **LSP/autocomplete** — final phase; only scaffolding earlier.

Autocomplete must not block the editing backend or the refresh path. The P5 LSP work is allowed to improve
completion; it is not allowed to be a prerequisite for opening, reading or editing a file.

## 3. Fixed constraints

These come from the repository and the brief, and are not open questions:

1. **JS/JSX only, no TypeScript transform.** Source stays `.js`/`.jsx`; JSDoc and d.ts provide editor
   quality. The JSX runtime is `@jsx6` (`jsxImportSource: '@jsx6'`), never React ([agent-rules.md](../docs/stack/agent-rules.md)).
2. **No SSR, no virtual DOM assumptions.** Preview is a real browser document; the editor uses the real DOM.
3. **Bun workspace, esbuild, `@jsx6/build`, local gate, no CI.** A new app is discovered by `apps/*`; its
   own `bun test` and build are the app-level verification ([README.dev.md](../README.dev.md)).
4. **TypeScript is LSP-only, never a build or check step.** No `tsc` invocation for jsxed source, no
   TypeScript compile/check in the app build, and no TypeScript in the app/preview bundle. The repository's
   existing TypeScript 7 devDependency remains for library declaration emit; that is unrelated to jsxed.
   The LSP may use TypeScript in either a local sidecar (prefer TypeScript 7) or a browser worker. This is
   the language service, not `tsc`: it answers editor requests and never emits or checks at build time. A
   browser worker needs a browser-capable language service; use TS 7 if such a build exists, otherwise
   the last JavaScript-based TS 6 may be used **only as an optional LSP asset**, never for build/check and
   never as an app dependency ([TS 6.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/),
   [TS 7 package](https://registry.npmjs.org/typescript/latest)).
5. **Two copies of `@jsx6/jsx6` in one realm are forbidden** (`JSX6E15`). The preview therefore lives in a
   separate iframe realm, and the editor bundle must not accidentally bundle a second copy into the top
   document.
6. **Markdown/doc examples are not tests**; browser-only checks are local and manual or a Chrome smoke
   script, never CI.
7. **v1 is server-assisted.** A local Bun server owns the preview transform and the LSP sidecar proxy.
   `apps/nodditor` and `apps/repl` build to `build/` and serve with `live-server`; jsxed keeps that dev
   ergonomics but adds a small application server. A backend-free build is a later milestone.
8. **The transform/LSP server is not a public execution service.** It is a local development tool. Serving
   it to untrusted users requires a separate sandbox/origin design; do not ship the dev server as a public
   multi-tenant product.

---

## 4. Initial architecture

### 4.1 Shape

```text
┌────────────────────────── apps/jsxed browser (JSX6 UI) ──────────────────────────┐
│  editor pane                 │  panels / overlay (JSX6)     │  preview (iframe)   │
│  CodeMirror 6                │  structure, DOM, layout      │  user code          │
│  source of truth: doc text   │  breadcrumbs, state          │  real DOM           │
└───────────────┬──────────────┴──────────────┬───────────────┴──────────┬──────────┘
                │ LSP over WebSocket           │ POST /transform           │ _source / DOM
        ┌───────▼─────────┐           ┌────────▼─────────┐        ┌───────▼─────────┐
        │ Bun app server  │           │ transform client │        │ preview runner  │
        │ /lsp proxy      │           │ (fetch)          │        │ execute bundle  │
        │ /transform      │           └────────┬─────────┘        └───────┬─────────┘
        └───────┬─────────┘                    │                          │
                │ stdio LSP                    │ esbuild JS API           │
        ┌───────▼─────────┐           ┌────────▼─────────┐        ┌───────▼─────────┐
        │ TS 7 sidecar    │           │ code + map +     │        │ source model    │
        │ tsgo --lsp      │           │ structure        │        │ + DOM index     │
        └─────────────────┘           └──────────────────┘        └─────────────────┘
```

The top document never renders user code. It owns CodeMirror, the JSX6 panels and the source↔DOM index.
The iframe owns the user's DOM. The Bun server owns the esbuild transform and proxies a TypeScript 7
language server over stdio. An **optional** browser worker sits behind the same transport interface; it
can host a TypeScript LSP (TS 7 if browser-capable, else an optional TS 6 asset) or JSX6-only features,
and it is not required for v1. An optional **jcodebuddy webview host** (JetBrains, VS Code, Eclipse,
`webviewd`) can own the editor and source text in guest modes; jsxed then drives it through the frozen
`open`/`file`/`api/v1` contract (§4.11). A **service worker** sits between the app and the network for
vendor/app/CSS caching, with routing + state restoration making refreshes cheap (§4.13).

### 4.2 Proposed modules

| path                              | responsibility                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `src/index.jsx`                   | app shell, layout, persistence, keyboard map                                   |
| `src/editor/CodeMirror.jsx`       | JSX6 wrapper around `EditorView`; create/destroy, value, selection             |
| `src/editor/extensions/`          | theme, keymaps, source-map decorations, fold/freeze, view modes                |
| `src/language/client.js`          | `@codemirror/lsp-client` setup, document sync, capabilities                    |
| `src/language/transport.js`       | two `Transport`s behind one interface: WebSocket (default) and worker (opt-in) |
| `src/language/worker.js`          | optional worker: TS LSP or JSX6-only LSP server                                |
| `src/language/jsx6/`              | client-side JSX6 completions, diagnostics, hover, code actions                 |
| `src/preview/Frame.jsx`           | double-buffered iframe, sizing, lifecycle, inspect events                      |
| `src/preview/runtime.js`          | iframe-side bootstrap/require shim for the bundle returned by `/transform`     |
| `src/preview/transformClient.js`  | debounced fetch to `/transform`, cancellation, error mapping                   |
| `src/model/structure.js`          | AST summary types: JSX elements, components, attrs, signals, ranges            |
| `src/model/sourceDom.js`          | source offset ↔ DOM element index, line/column mapping                         |
| `src/model/styles.js`             | CSS index: class/selector → stylesheet source; read-only first                 |
| `src/runtime/appSession.js`       | future app entry/runtime provenance interface; unimplemented in v1             |
| `src/views/`                      | Structure, DOM, Layout, Focus, Breadcrumbs (all JSX6)                          |
| `src/persist.js`                  | localStorage/URL state, exported/imported source                               |
| `src/app/router.js`               | History API routes, deep links, navigation fallback                            |
| `src/app/restore.js`              | pre-paint state restore (cursor, scroll, view, panels, focus)                  |
| `src/sw/service-worker.js`        | cache strategies, update protocol, offline/navigation fallback                 |
| `src/sw/client.js`                | registration, update messages, controller change, version handshake            |
| `src_build/swManifest.js`         | build manifest: shell/app/vendor hashes, cache names, precache list            |
| `src/preview/refresh.js`          | template/CSS refresh without a full shell reload                               |
| `src/bridge/hostBridge.js`        | host discovery, capabilities, open/read/propose/apply/watch (webview contract) |
| `src/bridge/documentSession.js`   | who owns the document: built-in editor, host editor, or preview-only           |
| `src/bridge/editorHost.js`        | jsxed's `EditorHost` adapter for a webview-owned standalone host               |
| `server/hostClient.js`            | reads `.jcodebuddy/webview/host.json`, probes `/health`, holds the host token  |
| `server/hostProxy.js`             | browser ↔ host proxy (`/host/open`, `/host/file`, `/host/edit`, events)        |
| `server/index.js`                 | Bun.serve: static files, `/transform`, `/lsp`, history fallback                |
| `server/transform.js`             | esbuild JS API transform/bundle + source map + structure summary               |
| `server/parse.js`                 | server-side parser for the structure summary (Babel parser or Lezer)           |
| `server/lspProxy.js`              | WebSocket ↔ sidecar stdio LSP framing, process lifecycle                       |
| `src_build/build.js`              | esbuild app build, static copy, dev server launch (follow `apps/nodditor`)     |
| `src_build/vendor.js`             | separate vendor entry/chunk + `vendorHash`; never inlined into the app bundle  |
| `src_build/build-workers.js`      | optional worker bundle (TS LSP or JSX6-only features)                          |
| `src_build/type-bundle.js`        | build a JSON/JS map of `lib.*.d.ts` + `@jsx6/*` d.ts for the sidecar           |
| `static/`                         | `index.html`, CSS, `sw.js`, `sw-manifest.json`, generated `vendor/`            |
| `doc/service-worker.md`           | cache model, update protocol, reset/debug, IDE-webview caveats                 |
| `doc/refresh-dev.md`              | how to test soft/preview/CSS/vendor refresh, state restore, measured budgets   |
| `test/`                           | unit tests for pure modules and the transform endpoint                         |
| `smoke/`                          | Chrome/headless or manual browser scripts                                      |

A new library package is deliberately **not** in the plan yet. If a piece proves reusable (the CodeMirror
wrapper, the LSP transport, the source↔DOM index), extract it after P2 rather than guessing the boundary
now.

### 4.3 Data flow

1. **Doc change** → debounce → `POST /transform` on the Bun server. The server runs esbuild (and a parser
   for structure) and returns (a) a runnable bundle, (b) a source map, and (c) a compact structure summary
   (JSX ranges, tag/component names, attributes, `define()` registrations, signals).
2. **Same change** → LSP `didChange` (full text first, incremental later) + client-side JSX6 providers
   update.
3. **Preview** → iframe receives the self-contained bundle, executes it, captures errors.
4. **After render** → walk the preview DOM (including shadow roots), read `_source` from nodes, and build
   the source↔DOM index.
5. **Selection** → the index answers: an editor offset yields DOM element(s); a DOM element yields a
   source range. The result drives decorations, panels and overlays.
6. **Completion/hover/diagnostics** → LSP results (from the sidecar or the optional worker) merged with
   JSX6 client-side results; both are rendered with CodeMirror's native tooltip/panel UI or JSX6 DOM in
   completion `info`.
7. **Host mode** → when a jcodebuddy webview host is discovered, the source text comes from the host
   (`/file`, digest), edits go through the host's propose/apply routes, and host events trigger a re-read.
   The internal CodeMirror can be hidden, read-only, or a second view of the same text; it is not the
   owner of the document.

### 4.4 CodeMirror integration

Use individual extensions rather than the `codemirror` meta-package so the bundle stays understood:

- `@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/commands`,
  `@codemirror/autocomplete`, `@codemirror/lint`, `@codemirror/search`
- `@codemirror/lang-javascript` with `{ jsx: true }` for Lezer syntax highlighting, indentation, bracket
  matching and the fallback completion source
- `@codemirror/lsp-client` for semantic LSP features
- `@lezer/highlight` + a JSX6-tuned highlight style (CSS variables so themes are cheap)

The JSX6 wrapper needs care:

- Create `EditorView` in `oncreate`/`init`; hand it the container element. Never let a signal-driven JSX6
  re-render replace the editor's DOM (CodeMirror owns it).
- On teardown, call `view.destroy()` from the component's disposal path (`disposeNode`/`addDisposer`),
  not a made-up lifecycle hook.
- Keep the document as CodeMirror state. The app may mirror it into a signal for panels, but writes go
  through transactions, never by resetting the whole document on every tick.
- Use `Compartment` for switchable view-mode extensions, read-only/frozen ranges and theme changes, so
  switching modes does not recreate the editor or lose undo history.

Candidate custom extensions:

| feature                          | CodeMirror mechanism                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| element range highlight          | `StateField<DecorationSet>` with `Decoration.mark`                                         |
| hide/collapse a JSX block        | `Decoration.replace({ block: true })` + a widget header                                    |
| freeze (read-only) a block       | `EditorState.changeFilter` / transaction filter over frozen ranges, plus a lock decoration |
| inline component label/thumbnail | `Decoration.widget`                                                                        |
| JSX-aware folding                | `foldService` or explicit fold ranges from the structure model                             |
| breadcrumb                       | state field + JSX6 panel                                                                   |
| layout overlay                   | DOM overlay inside the iframe, driven by the source↔DOM index                              |
| inspect click                    | `EditorView.domEventHandlers` or iframe capture listener                                   |

"Freeze" is defined as **suppress edits inside a range while keeping it visible and syntax-highlighted**.
"Hide" is a replace decoration and must always have a visible affordance to reveal the code again. Neither
is allowed to alter the document.

### 4.5 Language layer (hybrid: sidecar + optional worker)

**Decision (2026-10-21): hybrid from day one.** Two transports sit behind one `Transport` interface:

1. **Sidecar (default).** The Bun app server exposes `/lsp` over WebSocket and proxies a TypeScript
   language server running as a child process over stdio. Use the **TypeScript 7-native LSP** if the
   installed toolchain exposes a usable `--lsp` mode. If no usable TS 7 LSP exists, the sidecar can run a
   `typescript-language-server`, but only if it runs on TypeScript 7; otherwise the sidecar reports
   unavailable and the optional worker or JSX6/Lezer completion takes over.
2. **Browser worker (optional).** A Web Worker can host either a TypeScript LSP or a JSX6-only LSP server.
   For TypeScript, use a browser-capable TS 7 service if one exists; otherwise the last JS-based TS 6
   language service may be shipped **only as an optional LSP worker asset**. No `tsc`, no build/check, no
   app bundle. If TypeScript is disabled, the worker serves JSX6-only completion/hover/diagnostics.

Both transports speak standard LSP for one virtual file (`file:///main.jsx`). The worker may expose fewer
methods than the sidecar. The editor code does not branch on which transport is active; a small connection
factory chooses one and reports its state.

**Layering: TypeScript LSP (sidecar or worker) + JSX6 providers.**

- CodeMirror gets semantic completion, hover, diagnostics, definition and document symbols from the LSP
  plugin.
- JSX6-specific completion, diagnostics and hover are client-side providers fed by the structure model and
  the preview's runtime registry. They are merged into the same CodeMirror completion UI.
- Rationale: JSX6 features need AST/runtime data that already exists on the client; keeping them out of
  the LSP server keeps the adapter small and keeps rich, JSX6-rendered completion previews easy. A
  composite server can be added later if ranking/resolve demands it.

**Deferred: composite server.** If merging in CodeMirror proves too weak (ordering, resolve, snippets from
two sources), move the JSX6 providers behind the same transport and return one ranked LSP completion list.
The transport abstraction keeps this open.

LSP server scope for P1:

| method                                                | P1?               | notes                                                       |
| ----------------------------------------------------- | ----------------- | ----------------------------------------------------------- |
| `initialize` / `initialized`                          | yes               | capabilities, UTF-16 positions                              |
| `textDocument/didOpen` / `didChange` / `didClose`     | yes               | full sync first, incremental later                          |
| `textDocument/completion` + `completionItem/resolve`  | yes               | the core feature                                            |
| `textDocument/hover`                                  | yes               | TS quick info + JSDoc                                       |
| `textDocument/publishDiagnostics`                     | yes, syntax first | add semantic diagnostics once the JSX6 d.ts surface is good |
| `textDocument/definition`, `documentSymbol`           | nice to have      | supports outline/breadcrumb later                           |
| `rename`, `references`, `signatureHelp`, `codeAction` | deferred          | after parity is measured                                    |
| semantic tokens                                       | no                | Lezer already highlights; revisit only if needed            |

**Sidecar details (P1 spike must validate):**

- Start the language server lazily on the first completion/hover request, not at app boot. Keep one child
  per editor session; restart on crash with a bounded retry count and a visible status.
- Resolve the TS 7 tool from the repository/workspace toolchain (`tsgo` on `PATH`, or the root
  devDependency); do not add `typescript` to `apps/jsxed/package.json` just to launch it.
- The server's working directory is the app workspace; compiler options come from initialization options
  or a generated `jsconfig`/`tsconfig` equivalent: `allowJs: true`, `checkJs: true` (tune),
  `jsx: 'react-jsx'`, `jsxImportSource: '@jsx6'`, `target: 'esnext'`, `module: 'esnext'`,
  `moduleResolution: 'bundler'`, `noEmit: true`, `skipLibCheck: true`, `strict: false`, `types: []`.
- The sidecar needs the type surface: `lib.*.d.ts`, `@jsx6/*` d.ts and the JSX6 JSX declaration file. The
  build produces a version-stamped type bundle; the server makes it available to the child process (a
  temporary virtual workspace or a generated d.ts directory).
- The proxy translates WebSocket messages ↔ LSP stdio framing. Prefer an existing JSON-RPC framing helper
  (`vscode-jsonrpc`) unless a small manual implementation is clearly safer.
- Do not expose `/lsp` or `/transform` on a public interface. The sidecar runs with the developer's
  privileges; the server is local-only by design.

**Optional browser worker details:**

- **TypeScript mode (optional):** host a TS language service in a Web Worker. Use TS 7 if a browser-capable
  build exists; otherwise the optional asset may be the last JS-based TS 6 language service. This is an
  LSP asset only: it is never used by `tsc`, never compiles/checks at build time, and is not imported by
  app code. `@typescript/vfs` (or a small custom host) and the same type bundle as the sidecar are
  required.
- **JSX6-only mode (fallback):** reuse the shared JSX6 provider modules for completion, hover and
  diagnostics. No TypeScript runtime at all.
- Both modes use the same virtual document identity (`/main.jsx`) and the same structure model as the
  client.

**Type surface (d.ts), required by the sidecar/optional TS worker and shared with client providers:**

- Start with app-local `apps/jsxed/types/jsx6-jsx.d.ts`; promote it to `@jsx6/jsx6` (or a dedicated type
  package) only after it proves stable. d.ts is allowed precisely because it does not affect bundling.
- Declare the JSX namespace TypeScript expects: `IntrinsicElements`, `Element`, `ElementClass`,
  `ElementAttributesProperty`, `ElementChildrenAttribute`, plus module declarations for
  `@jsx6/jsx-runtime` and `@jsx6/jsx-dev-runtime` (`jsx`, `jsxs`, `jsxDEV`, `Fragment`).
- Intrinsic elements: generate a baseline from `lib.dom.d.ts`'s `HTMLElementTagNameMap` + per-tag element
  properties, then override the JSX6 contract: `class` (never `className`), string `style`, `p`, `x-*`,
  lower-case `on*`, `key`, and `data-*`/`aria-*` index signatures. Custom elements need a permissive tag
  index and can be refined from `define()` analysis.
- Function components get props from their first parameter/JSDoc. Class components need a generic
  `JsxW<Attr>` helper or a type-only `props` member; the client-side provider fills in attribute names
  inferred from `tpl(attr)` reads where TypeScript cannot.
- Do not enable semantic diagnostics until the valid corpus is clean; start with completion and hover.

**Failure behaviour:** if the sidecar is down, try the optional TypeScript worker if it is enabled;
otherwise the editor keeps working with `@codemirror/lang-javascript` completion + JSX6 providers. The
status area says which language path is active; never block typing on a connection.

Document identity: standalone uses `/main.jsx`; guest mode uses the one host file's path/URI. It is still
one document at a time. The transform `sourcefile` and the `_source.fileName` must be the same path as the
open/navigation target, or "open in host" and the source↔DOM map disagree. Multi-file support later needs a
URI scheme and a file map; do not pretend a single-file server is a workspace server.

### 4.6 Preview execution

**Decision (2026-10-21): transform on the Bun server with esbuild.** The REPL's Babel pipeline stays in the
REPL; jsxed uses the server for both transform and bundling, which removes the client-side Babel asset and
the synchronous `require` shim.

Proposed P0 pipeline:

1. `POST /transform` with the document text and the session path as `sourcefile` (`main.jsx` standalone,
   the host file path in guest mode).
2. The server calls the esbuild JS API with `stdin` (`sourcefile: session.path`, `resolveDir` set to the
   workspace root), `bundle: true`, `format: 'iife'`, `platform: 'browser'`, `jsx: 'automatic'`,
   `jsxImportSource: '@jsx6'`, `jsxDev: true`, `write: false` and inline source maps. The bundle is
   self-contained: `@jsx6/*` imports resolve from the workspace and the iframe does not need a module
   loader.
3. The same request returns a structure summary from a server-side parser (or the client derives it from
   the Lezer tree; see §4.7). The summary is compact JSON, not an AST.
4. The iframe receives the bundle through `srcdoc`/`postMessage`, executes it, captures
   `console.error`/`window.onerror`, and signals completion. Use the double-buffered `FlipFrame` pattern:
   keep the previous frame visible until the new one is ready; never show a half-rendered frame.
5. Read `_source` from the rendered nodes; build the index.

`jsxDEV` records `{ fileName, lineNumber, columnNumber }`. A probe against the pinned `esbuild@0.17.18`
confirmed that `jsxDev` emits this object with a 1-based `lineNumber` and a 1-based `columnNumber`:
`<div` after `const x = ` produced `columnNumber: 11`. Normalize source positions to CodeMirror offsets in
one place. `libs/jsx-dev-runtime/src/activateJsxInspector.js` already walks `_source` and shadow roots;
jsxed reuses the data, not the context-menu inspector.

Bundling consequences and limits:

- Workspace imports (`@jsx6/*`, and local files if multi-file ever arrives) resolve on the server. This is
  a strong reason to keep the server even after a static mode exists.
- No arbitrary npm/CDN resolution in v1. A failed import is a transform error shown in the panel.
- Transform errors (esbuild) and runtime errors (iframe) are different channels; both need a source
  location. esbuild's error `location` is mapped through the source map when possible.
- **Infinite loops:** the REPL's Babel `preventInfiniteLoops` plugin does not apply to esbuild's
  transform. v1 uses a run timeout plus a "stop" button that reloads the iframe; a synchronous infinite
  loop freezes the preview until that happens. If this is unacceptable, add a server-side pre-pass (the
  REPL plugin still runs on Babel on the server) or an instrumentation step; do not let the main editor
  thread freeze.
- The preview is a separate iframe; the `allow-same-origin allow-scripts` combination is a documented
  security decision (the REPL already records it). jsxed is a local tool and must not be presented as a
  sandbox for hostile code.

### 4.7 Source ↔ DOM bridge

This is the foundation for every visual mode. It should be built and tested before the fancy views.

**Data available:**

- `_source` on rendered nodes: `fileName`, `lineNumber` (1-based), `columnNumber` (verify the exact base in
  P0; esbuild's `jsxDev` source object is the input).
- The structure model from the server parser (Babel parser or Lezer): every `JSXElement`/`JSXFragment` with
  start/end offsets, tag/component name, attributes and parent.
- The preview DOM: elements, shadow roots, text nodes, computed layout rectangles.

**Model:**

```js
SourceRange = { file, start, end, line, column, kind: 'jsx' | 'css' | 'html' }
ElementInfo = {
  el,                 // DOM element (possibly a custom element)
  range,              // nearest JSX element range
  component,          // owning component name, when known
  depth,              // nesting depth in the rendered DOM (not source)
  shadow,             // whether it lives in a shadow root
}
```

**Queries:**

- `elementsAtOffset(offset)` → all rendered elements whose JSX source range contains the offset, deepest
  first. Selecting source highlights all matching elements (loops may produce several).
- `rangeAtElement(el)` → nearest JSX range, then an editor selection. If an element has no `_source`
  (fragment/array return), walk to the nearest source-bearing ancestor/child and mark the result as
  approximate.
- `rangeAtPosition(line, column)` → exact AST range by position, independent of rendering.
- `elementCount(range)` → "3 rendered instances" for loops.

**Indexing:** a per-file index keyed by `SourceRange.file` and, within a file, a sorted array by source
start plus a map from start offset to elements; binary search for containment, then filter by end. Rebuild
after each successful render and after each parse. v1 has one file, but the structure does not assume it;
for typical component files this is trivial, so no interval tree is needed initially.

**Documented limitations to test in P0:**

- A component that returns a fragment or an array has no single DOM node to carry `_source`; map to its
  first source-bearing descendant and label it approximate.
- `Loop`/`Loop2` render many nodes from one source range: one-to-many, grouped in the UI.
- `JsxWS` shadow roots: traverse them explicitly; the existing inspector has a `findShadowRoot` helper.
- Re-renders replace nodes: never cache DOM element references longer than one render generation; key
  caches by generation.
- Text nodes have no `_source`; map them to the enclosing element.

### 4.8 Viewing modes

The modes are the product differentiator. Start with four, each with a single clear question:

| mode          | question it answers                        | code surface                                                       | preview surface                                                   |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Code**      | "What is the source?"                      | full editor, no structure chrome                                   | preview as-is                                                     |
| **Structure** | "What are the parts and how do they nest?" | JSX nesting highlighted; outline panel with component/element tree | optional dimming; selecting a node highlights its DOM             |
| **Layout**    | "How is it laid out on screen?"            | selection-linked code ranges                                       | overlay boxes/labels, container/flex/grid emphasis, spacing hints |
| **Focus**     | "Show me only this part."                  | unrelated ranges dimmed/collapsed/frozen on request                | unrelated DOM dimmed or hidden; selected subtree isolated         |

Later candidates (P3+): **DOM tree** with computed boxes, **Component lens** (inline preview/signature
next to a component), **State** panel (live signals and their bound DOM), **Explain** (step through JSX
creation).

Mechanics:

- View mode = a `Compartment` containing a set of decorations + panel visibility + CSS classes. Switching
  is non-destructive and preserves the document, selection and undo history.
- The **Structure** tree is built from the AST, not the DOM, so it works before a successful render and
  includes code that renders conditionally.
- The **DOM tree** is built from the iframe and is the runtime truth; both trees share selection sync.
- The **Layout** overlay is injected into the iframe (pointer-events: none), positioned from
  `getBoundingClientRect()` relative to the iframe viewport. Recompute on scroll/resize and after each
  render; remove before a new run. The same mode can show the read-only matching CSS rules/classes for the
  selected element from `StyleIndex` (the future CSS-edit scaffolding).
- **Focus** uses dim/collapse decorations and, optionally, a frozen range. It must never hide the way back
  to full code: Escape or the mode switch restores everything.
- Keyboard: one shortcut per mode, plus an "inspect" toggle (Alt+click in the preview by default) so normal
  preview interaction is not hijacked.
- When a host editor is present, the same selection offers **"open in editor"**; in guest-preview mode the
  host becomes the editing surface and jsxed keeps the visual modes (§4.11).

The first P0 visible outcome should be the simple version of G2: move the caret into a JSX element and see
the corresponding preview element outlined; Alt+click a preview element and see the source selected.

### 4.9 Completion: parity first, then beyond

**Parity plan**

- Build a corpus of ~30 real JSX6 snippets: function components, `JsxW` components with `define()`,
  signals, `x-*` directives, `p` scopes, forms, `Loop`, shadow DOM, event handlers, dynamic tags,
  fragments, spreads.
- Baseline Monaco in `apps/repl` (TS worker) against jsxed on the same corpus and the same TypeScript
  settings. Record: is the expected item present, its rank, latency, and whether its docs are useful.
- Only after the baseline is honest should JSX6-specific items be added on top. Avoid the trap of a
  custom engine that looks impressive in a demo but loses to TS on ordinary JavaScript.

**JSX6 layer (client-side, P3)**

| feature                    | source of truth                                                                       | value                                               |
| -------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| component names + props    | structure model: `function C(attr)`, `class C extends JsxW`, `tpl(attr)` reads, JSDoc | completions Monaco does not have                    |
| custom element tags        | `define('x-…', C)` calls, preview `customElements` registry                           | suggests only tags that exist                       |
| JSX6 attributes/directives | fixed list + docs (`p`, `x-*`, `on*`, `oncreate`)                                     | correct DSL completion                              |
| signals                    | `signal()`, `$S`, `$F`, `$C`, `$State` declarations and names                         | suggest as children/attributes; show live value     |
| `p` scope paths            | parsed `p="a.b"` and component scope                                                  | path completion and navigation                      |
| CSS classes                | `class="..."` literals + stylesheets in the preview                                   | class completion with a visual swatch               |
| event names                | JSX6's `on` + lower-cased event convention                                            | avoid React-style `onClick` habits                  |
| component attribute names  | attributes read in `tpl`/function body, JSDoc types                                   | fill the gap TypeScript leaves for class components |
| rich completion info       | a live mini JSX6 preview / attribute table rendered as a DOM node                     | "beyond Monaco" visibly, and dogfoods the stack     |

**Diagnostics beyond TS**

Start with the mistakes that fail silently in JSX6 (all documented in
[agent-rules.md](../docs/stack/agent-rules.md)):

- `className` instead of `class`
- a function-valued attribute that is probably an accidental subscription
- unknown `x-*` directive
- duplicate `define()` registration / conflicting tag
- `p` on an element where the scope path is never read
- missing/duplicate `key` in a `Loop` item
- `setValue($signal, v)` misuse (signal read vs write)
- `JsxW` destroy-hook misuse

These can be CodeMirror linter diagnostics with quick fixes; they do not need the LSP server. TS semantic
diagnostics are added only once the JSX6 d.ts surface is good enough not to drown the user in noise.

### 4.10 Self-hosting / dogfooding

"Develop jsxed using jsxed" can mean very different amounts of work. Stage it:

| stage  | meaning                                                                                      | cost        |
| ------ | -------------------------------------------------------------------------------------------- | ----------- |
| **S1** | jsxed edits its own demo/example components; changes persist locally or export               | low         |
| **S2** | jsxed opens jsxed's own `src/` components from a dev workspace, previews them in isolation   | medium      |
| **S3** | an embedded jsxed instance edits a component that is part of jsxed while the app runs        | medium/high |
| **S4** | jsxed boots from its own source without a prebuild (browser-side module resolution/bundling) | high        |

**Decision (2026-10-21): S2 is the dogfood target.** S1 is the minimum that should work along the way; S2
(open real `src/` components in a dev workspace and preview them in isolation) is what counts as "developing
jsxed with jsxed" for P4. S3/S4 are research goals, not plan dependencies; S4 in particular would need a
browser-side bundler/loader and changes the transform decision.

### 4.11 Cooperation with host editors (jcodebuddy webview)

The sibling product at `D:\wrk\java\jcodebuddy\webview` already solves "a page drives an editor": a frozen
navigation contract (`window.openFile`, `data-open`, `/open`, `/health`), a write contract
(`/api/v1/diff`, `/api/v1/applyEdit`, `/api/v1/undo`, `/api/v1/redo`, `/api/v1/events`), and hosts for
JetBrains, VS Code, Eclipse and a headless `webviewd`. jsxed should consume that contract rather than invent
an editor-specific integration. See [webview README](../../java/jcodebuddy/webview/README.md),
[the navigation contract](../../java/jcodebuddy/webview/kit/doc/contract.md),
[the edit API](../../java/jcodebuddy/webview/kit/doc/edit-api.md),
[the host API](../../java/jcodebuddy/webview/doc/webview-host-api.md),
[`EditorHost`](../../java/jcodebuddy/webview/core/webview-core/src/main/java/hr/hrg/webview/core/EditorHost.java)
and [the sidecar](../../java/jcodebuddy/webview/jwa-sidecar/README.md).

Host availability is user setup: the IDE plugins are installed by the user, and the HTTP transport is off
until configured. jsxed must treat "no host" as a normal standalone state, not an error.

This matters for three reasons:

- jsxed's internal CodeMirror/LSP may be incomplete for a long time; the host editor already provides
  completion, refactors, debugging, save/undo and the project model.
- jsxed's differentiator is the live preview, source↔DOM bridge and visual modes; it can provide those
  **next to** the host editor instead of requiring its own editor.
- The same contract lets a **webview-owned standalone host** drive jsxed later, with jsxed contributing
  only an `EditorHost` adapter (docs, dashboards and graph pages can then open/edit in jsxed).

#### 4.11.1 What the host offers

| host surface                                                 | what it gives                                                                            | jsxed use                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| injected `window.openFile(path, line, column)` + `data-open` | open a location in the host editor                                                       | preview click, structure panel "open in editor"             |
| `GET /open`, `GET /health`                                   | the same over HTTP; capabilities, `project`, `ide`; `/.well-known` adds `lineNavigation` | fallback when injection is unavailable; feature detection   |
| `GET /file/<path>` with `X-WebView-Digest`                   | project file bytes + digest                                                              | source text when the host owns the document                 |
| `GET /page/<path>`                                           | a page served with the bridge injected                                                   | optional embedding; jsxed normally runs from its own server |
| `POST /api/v1/diff`                                          | proposal + unified diff, nothing written                                                 | show a refactor/quick fix before applying                   |
| `POST /api/v1/applyEdit` (`target: auto\|buffer\|disk`)      | edit the host buffer or disk                                                             | apply jsxed proposals; `buffer` preserves host undo         |
| `POST /api/v1/undo`, `/redo`                                 | host checkpoints                                                                         | delegate undo of host-applied edits                         |
| `GET /api/v1/events` (SSE)                                   | file-change events                                                                       | re-read/re-render when the host saves                       |
| `.jcodebuddy/webview/host.json` + token file                 | actual port, token path (may be empty), project, capabilities                            | server-side host discovery — never assume a port            |
| `window.__jcbWebViewBridge`                                  | injected contract version                                                                | compatibility check                                         |

The Java `EditorHost` SPI is the right shape to mirror in TypeScript: `openFileAt`, `focusOpenFile`,
`reveal`, `select`, `applyEdit`, `capabilities`, and `lineNavigation` (`exact`, `file-only`, `none`).
Capabilities are **advertised only when implemented**; a missing `edit`, `diff`, `undo` or `watch` hides the
corresponding jsxed affordance rather than making it fail at click time. The page contract and the five
write routes are frozen; new routes, capabilities and refusal reasons may appear, so jsxed must ignore
what it does not know, act on `applied`/status rather than exact failure text, and gate optional features
on `capabilities`. `window.__jcbWebViewBridge` / `bridgeVersion` is the compatibility check.

#### 4.11.2 Integration options

| option                                                 | what it gives                                                                                     | cost        | plan             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ----------- | ---------------- |
| **A. Guest page, navigation only**                     | preview/structure clicks open the file in the host editor at line/column                          | low         | P1               |
| **B. Guest page, host-owned editing**                  | jsxed reads the host file, proposes/applies edits into the host buffer, re-renders on save events | medium      | P3               |
| **C. Standalone host (webview-owned) + jsxed adapter** | other webview pages open/edit files in jsxed; host core stays in webview                          | medium/high | P4               |
| **D. LSP cooperation**                                 | live buffer text via `didOpen`/`didChange`, edits via `workspace/applyEdit`, navigation via `window/showDocument` | high | research |
| **E. Clipboard / deep link**                           | copy `path:line` or an editor-specific URL                                                        | low value   | last resort only |

Recommendation: **A, then B**; C after the editor is stable **and** the webview-owned standalone host is
extractable; D if live unsaved text is needed and the host buffer route is unavailable. A and B are enough
to cooperate with an editor while jsxed's internal editor is still weak. E is not an integration: it has no
capability/status contract, so jsxed should not advertise it as one.

The typical embedding is the IDE's webview pointed at jsxed's own server URL. That page is often
cross-origin relative to the IDE host, so the **HTTP contract is the baseline**; the injected
`window.openFile` is a bonus when the host loads jsxed through `/page/` or injects into a same-origin frame.
Do not depend on a wrapper-specific `postMessage` convention (the VS Code wrapper forwards `{type:'openFile'}`
today, but that is not the frozen contract).

#### 4.11.3 Modes and document ownership

| mode              | source owner | editing                           | preview | notes                                                  |
| ----------------- | ------------ | --------------------------------- | ------- | ------------------------------------------------------ |
| **standalone**    | jsxed        | internal CodeMirror               | jsxed   | default when no host is discovered                     |
| **guest-preview** | host         | host editor                       | jsxed   | safest early mode; jsxed never writes                  |
| **guest-editor**  | host         | host buffer; jsxed proposes edits | jsxed   | internal CodeMirror is hidden or a read-only mirror    |
| **host**          | jsxed        | internal CodeMirror               | jsxed   | webview-owned standalone host drives jsxed via adapter |
| **lsp-attached**  | host editor  | host editor                       | jsxed   | live text via LSP; research                            |

`DocumentSession` owns the mode and the document identity:

```js
DocumentSession = {
  mode,            // standalone | guest-preview | guest-editor | host | lsp-attached
  owner,           // 'jsxed' | 'host'
  liveSource,      // 'lsp' | 'host-buffer' | 'host-file' | 'builtin'
  text,            // current source used by the parser/transform/source map
  digest,          // host digest when the active source is a host file/buffer
  path,            // project-relative or absolute host path
  projectRoot,     // future app mode; the project the host serves
  files,           // future app mode; one entry in v1
  revision,        // local generation, so stale async results are dropped
}
```

The preview transform, structure model and source↔DOM index always read `DocumentSession.text`, never a
private CodeMirror document. That is the one rule that keeps standalone and host modes from forking.

#### 4.11.4 `HostBridge` API (proposed)

```js
HostBridge = {
  discover(): {
    mode, project, ide, port, capabilities, lineNavigation, bridgeVersion
  },
  open(path, line, column): 'injected' | 'http' | 'internal' | 'clipboard',
  read(path): { text, digest },                 // host file bytes
  readBuffer?(path): { text, digest, version }, // optional host buffer-read capability
  diff(path, expectedDigest, edits): { unifiedDiff, digest },
  apply(path, expectedDigest, edits, target): { applied, target, digest, detail },
  undo(path), redo(path),
  watch(onChange): { watching, close },
}
```

Implementation notes:

- **Discovery is server-side.** `server/hostClient.js` reads the project's
  `.jcodebuddy/webview/host.json`, probes `GET /health`, checks that `project` matches the jsxed project,
  reads `tokenPath`, and falls back to `.jcodebuddy/conf/webview.json`; it never assumes a port. The token
  stays in the Bun server; the browser calls jsxed's own `/host/*` proxy, so the secret is never exposed to
  page JS. If the page has an injected `window.openFile`, navigation can call it directly.
- **A host may keep its token in editor settings, not a file** (VS Code writes an empty `tokenPath`). jsxed
  then needs the token supplied explicitly (`--host-token`/env) or it must stay on the navigation-only
  rung. Do not guess or scrape editor settings.
- **Reads use the host's digest.** `/file` answers with `X-WebView-Digest`; if a host omits it, hash the
  text once (the [kit client](../../java/jcodebuddy/webview/kit/examples/with-assets/assets/webview-client.js)
  does the same). Never invent a digest for an edit.
- **Edits are two-step.** Always `diff` first, show the unified diff, then `applyEdit` with the **same**
  `expectedDigest` that was read. Prefer `target: 'buffer'`; `auto` is acceptable only when the user has not
  asked for a destination; never write disk silently. Handle `409 stale` by re-reading and re-proposing,
  and `409 no-buffer-edit` / `no-disk-write` by telling the user which host can do it.
- **Watch is capability-gated.** Use `/api/v1/events` when `watch` is present. Without it, re-read on
  window focus and on an explicit refresh, not on a fast poll.
- **Rate limit is shared** (20 per 20 s in the reference implementation). jsxed applies edits only on an
  explicit action, never on every keystroke, and debounces re-reads.
- **No direct disk writes in guest mode.** The host owns the bytes; writing disk behind its buffer would
  create two copies, two undos and a lost buffer. `target: 'disk'` is a user-chosen escape hatch, not a
  fallback.
- **Project mismatch is a refusal.** If `/health.project` is not the jsxed project root, do not use that
  host. Same rule for any path outside the project: the host's jail is authoritative.

#### 4.11.5 Closing the buffer-read gap: use both channels

The current contract reads **file bytes** (`/file`) and writes the **editor buffer**
(`/api/v1/applyEdit target: buffer`); `/api/v1/events` is about file changes. A host editor with unsaved
changes therefore exposes only its last saved text. Two channels can close that gap, and the plan uses
**both**; they are complementary, not alternatives:

| channel              | model     | text source                                                | edit channel                            | prerequisites                              | trade-off                                                                                          |
| -------------------- | --------- | ---------------------------------------------------------- | --------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **Host buffer-read** | pull      | new optional `readBuffer` capability (e.g. `GET /api/v1/buffer?filePath=…` or `/file?target=buffer`) returning text + digest + version | host `/api/v1/applyEdit target: buffer` | host change + capability; same token/jail | simple, works for any webview host; refresh/poll latency; needs a host release |
| **LSP live buffer**  | push      | `textDocument/didOpen` + `didChange` with document version | `workspace/applyEdit`                   | jsxed LSP server + per-editor registration | instant unsaved text, works without a webview plugin (Zed pattern); separate setup, no digest/jail |
| **Host file**        | pull/save | `/file` + `watch`/events                                   | host applyEdit                          | existing contract                          | works today; save-synced only                                                                      |

**Only one channel is active per session** (`DocumentSession.liveSource`), chosen by priority:

| priority | `liveSource`  | text                           | edit                              | when                                           |
| -------- | ------------- | ------------------------------ | --------------------------------- | ---------------------------------------------- |
| 1        | `lsp`         | `didChange` (versioned)        | `workspace/applyEdit`             | an editor is connected to the jsxed LSP server |
| 2        | `host-buffer` | `readBuffer` (digest/version)  | host `applyEdit` `target: buffer` | the host advertises the buffer-read capability |
| 3        | `host-file`   | `/file` + events/focus refresh | host `applyEdit` `target: buffer` | a host exists but has neither of the above     |
| 4        | `builtin`     | CodeMirror                     | local                             | standalone                                     |

Rules that make "both" safe:

- **Never mix channels within one edit.** Text from LSP has a document version; text from the host has a
  digest. Use the metadata of the source that produced the text, and reset the local revision on a switch.
- **One edit channel at a time.** Either `workspace/applyEdit` (LSP) or host `/api/v1/applyEdit`; never both
  for the same change. Undo belongs to the active editor, not to a second jsxed history.
- **LSP wins when connected**, because it is push-based and carries unsaved text. Host buffer-read is the
  fallback for editors that do not run jsxed's LSP, and the simpler path for a webview-only host. Host file
  is the save-synced last resort.
- **The host route is optional, not assumed.** It needs a new host capability; until it exists, use LSP or
  save-synced file mode. The contract allows new routes/capabilities, and the client feature-detects.
- **Do not force a disk write to simulate a read.** That is the one thing neither channel does.
- **Transform is debounced in both push and pull modes.** LSP can deliver changes per keystroke; jsxed still
  debounces the esbuild call (the preview does not need every intermediate keystroke).

Why both: the host route is the low-friction path for any webview host, while LSP is the editor-agnostic
path (including editors with no webview plugin) and gives live unsaved text without a host release. Keeping
both means jsxed is useful in more places and is not blocked on one project's release cadence.

#### 4.11.6 Mapping jsxed interactions to the host

| jsxed interaction                                | host call                                                        | fallback when unavailable                             |
| ------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------- |
| Alt+click a preview element / "open in editor"   | `window.openFile` or `/open`                                     | select the source range in the internal editor        |
| "Apply to editor" on a structure/refactor action | `/api/v1/diff` → show → `/api/v1/applyEdit` `target: buffer`     | apply to internal CodeMirror only, with a clear label |
| External save                                    | `/api/v1/events` (or focus refresh) → `/file`                    | manual refresh                                        |
| Reveal in project tree                           | future `/reveal` capability (no frozen route yet)                | open the file                                         |
| Select a source range in the host                | no HTTP route today; open at the range start                     | internal selection / open the file                    |
| Replace a whole block / format                   | `applyEdit` buffer                                               | internal editor                                       |
| No host found                                    | all host actions hidden                                          | standalone mode                                       |

The `open` call is the highest-value integration and the cheapest: it makes every preview click and every
source↔DOM selection immediately useful in an IDE, even before jsxed can read or write the host buffer.

#### 4.11.7 Standalone host (webview-owned) and LSP

**The standalone editing backend is the "IDE half" without an IDE, and it should live in the webview
project.** There are two distinct uses:

1. **H1 (P1, hard requirement): jsxed is a client of the standalone backend.** The backend owns file
   open/read/save/watch, atomic writes, checkpoints, token/auth, path jail and port discovery. jsxed's
   file session calls it; jsxed does not write project files directly. No `EditorHost` adapter is needed
   for this.
2. **H3 (P4, optional): the standalone backend drives jsxed.** A webview page asks the backend to open a
   location in jsxed and apply an edit to jsxed's buffer; jsxed supplies the `EditorHost` adapter. This is
   what makes jsxed a target for other pages.

jsxed must not grow a second implementation of `/health`, `/open`, `/file`, `/page`, `/api/v1/*`, port
claiming, tokens and the path jail. Instead:

- **Webview owns the host core** — the standalone/HTTP implementation, its auth/conformance, and its
  `EditorHost` SPI. It is reusable by any page, not only jsxed.
- **For H3, jsxed owns only the `EditorHost` adapter** (`src/bridge/editorHost.js`): `openFileAt` moves
  the internal CodeMirror caret, `focusOpenFile` brings the jsxed view to the front, `select`/`reveal` map
  to the internal UI, and `applyEdit` applies a `TextEdit` list to the jsxed buffer. The adapter is the
  only jsxed-specific code; H1 needs no adapter.
- **Do not fork the security model.** If the webview-owned standalone host is not extractable yet, H3 stays
  deferred; jsxed remains a guest/standalone editor and does not ship its own host routes. The
  [conformance vectors](../../java/jcodebuddy/webview/conformance/bridge-decisions.json) stay the host
  owner's test table.
- **Value:** a webview page or tool can open a location in jsxed and apply an edit to jsxed's buffer
  through the same contract that drives an IDE; jsxed is then a real editor target, not only a page.
- **Transport of the adapter:** if the standalone host runs in the same Bun process, it calls the adapter
  directly; if it runs out of process, jsxed exposes a minimal loopback adapter endpoint. That choice belongs
  to the webview-owned host, not to the page-facing contract.

**LSP live-buffer channel (planned H4)** uses the `jwa-sidecar` pattern: an editor connects to jsxed as an
LSP server, sends live buffer text in `didOpen`/`didChange`, and receives `workspace/applyEdit`; jsxed can
also call `window/showDocument` if it is the client. This is the second implementation of
`DocumentSession.liveSource`, not a research orphan: it is the only channel that gives live unsaved text
without a webview host change, and it works for editors that have no webview plugin (the Zed pattern). It
needs per-editor registration (a Zed extension, an LSP client entry) and a minimal LSP server; that setup
cost is why H2 ships first.

#### 4.11.8 Host-integration track

| step   | when     | deliverable                                                                        | exit criterion                                                                                      |
| ------ | -------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **H0** | P0       | `HostBridge` interface, builtin adapter, project-root config; no host calls        | standalone still works; the seam is tested with a fake bridge                                       |
| **H1** | P1       | **standalone editing backend** extracted/consumed from webview; jsxed file session | open/read/save/apply/watch a project file through the backend; no direct fs; no IDE and no LSP      |
| **H2** | P2/P3    | IDE host integration: discovery, navigation, read/edit/watch, live buffer          | preview click opens a file in a live host; read/edit buffer with stale recovery; `liveSource` switch |
| **H3** | P4       | webview-owned standalone host + jsxed `EditorHost` adapter                         | a webview page opens/edits through jsxed; host auth/conformance stays upstream                      |
| **H4** | P5       | LSP live-buffer channel (`didChange` + `workspace/applyEdit`)                      | live unsaved text reaches the preview; one active `liveSource`; no double edit                      |

H1 is the hard requirement and must land before H2/H4. H2/H4 are cooperation layers; they do not gate
basic file editing.

### 4.12 Future: live application editing (scaffolding only)

The long-range target is not only a component scratchpad: jsxed should eventually edit a **running
application's templates and styles in place**. `jsxDEV` already puts `_source` on every rendered node
(`fileName`, `lineNumber`, `columnNumber`), so the provenance exists; the missing pieces are multi-file
source resolution and a CSS view of the same provenance.

This is **scaffolding, not v1 implementation**. The initial design must not make the future impossible:

- **File-aware provenance now.** `SourceRange` gets a `file` and a `kind` (`jsx`, `css`, `html`), and the
  structure/source↔DOM indexes are keyed by file. v1 still edits one document at a time, but no model,
  transform call, or `_source` mapping hardcodes `main.jsx`; the standalone default is just the value used
  when there is no host file.
- **Project-aware session now.** `DocumentSession` carries `projectRoot` and a file map (one entry in v1),
  so a future application session does not need a second document model.
- **CSS index now, read-only.** `src/model/styles.js` collects same-origin stylesheets (inline `<style>`,
  linked CSS where readable), indexes selectors/classes/custom properties, and can answer "which rules
  match this element?" for the Layout panel. Source ranges are approximate until a CSS parser/source map
  exists; cross-origin stylesheets are computed-style-only. No CSS editing in v1.
- **Runtime adapter interface only.** `src/runtime/appSession.js` defines an `AppSession`/`RuntimeAdapter`
  shape for an application entry URL, its iframe, provenance, and style access. It is a stub in v1; no
  application mode ships.
- **Template edit before module HMR.** The intended future loop is: edit a JSX/HTML template or a CSS
  rule → apply the text edit through the active host/LSP channel → refresh the preview (with the
  service-worker/state-restoration path from §4.13). **No module HMR**, no module-graph invalidation, no
  hot boundaries, no state-preserving module replacement. This keeps the future use case a source-editing
  problem rather than a bundler problem.
- **Bundled apps need source maps.** If the running app is bundled, `_source.fileName` must be mapped
  through the bundle's source map to the original file before an edit can be applied. That is future work;
  the scaffolding requirement is that provenance is a `SourceRef`, not a raw line number.

Explicit non-goals for this future work: module HMR, CSS-in-JS transformation, runtime state editing,
production app injection, multi-file editor UI, and CSS preprocessor semantics. The v1 deliverable is
only the file-aware data model, the read-only CSS index, and the interfaces; no application mode or
module-HMR code.

### 4.13 Service worker, routing and refresh

Smoothness is a product requirement, not a P4 optimization. "HMR-class" here means **fast asset refresh +
state restoration**, not a module hot-replacement system:

- **Preview refresh** (template or CSS change): rerun the transform and update the preview only; the
  jsxed shell and editor do not reload.
- **Shell refresh** (jsxed app code change): soft reload the shell with state restored; vendor libraries
  stay cached.
- **Full reload**: only when the **vendor/library version hash** changes, or when a cache/schema
  invariant makes a soft refresh unsafe.

This is why HMR is not needed: module graph invalidation and hot boundaries are the complex part, and the
user-visible win comes from cached libraries, a preserved session, and a fast preview rerun.

#### 4.13.1 What is cached

The build emits a `sw-manifest.json` with at least `buildId`, `appHash`, `vendorHash`, `shellHash`,
`cacheNames`, and a precache list. Cache names are versioned (`jsxed-vendor-<vendorHash>`,
`jsxed-shell-<buildId>`, `jsxed-dynamic-<appHash>`), so an old cache cannot be mistaken for a new one.

| request                                                        | strategy                                 | cache             | why                                                             |
| -------------------------------------------------------------- | ---------------------------------------- | ----------------- | --------------------------------------------------------------- |
| `/vendor/*` (jsx6, CodeMirror, LSP/TS assets, preview runtime) | cache-first, immutable                   | vendor version    | libraries are large; they must not be re-fetched on an app edit |
| jsxed app bundle/chunks, CSS, worker assets                    | stale-while-revalidate                   | app/build version | update without a full reload; background revalidate             |
| `/` and client routes (`/edit/...`)                            | network-first with cached shell fallback | shell             | routing + offline fallback; no stale shell silently             |
| `sw-manifest.json`, `sw.js`                                    | network-only / no-cache                  | none              | never serve a stale manifest                                    |
| `/transform`, `/lsp`, `/api/*`, `/host/*`, `/open`             | network-only                             | none              | dynamic, credentialed, must not be cached                       |
| preview iframe runtime/vendor                                  | cache-first                              | vendor version    | quick preview boot; user code is inline and not cached          |
| fonts/images                                                   | cache-first with version                 | build             | avoid flashes                                                   |

**Vendor split is a build requirement.** The app bundle must not inline the libraries the cache is
supposed to protect. The build emits a separate vendor entry/chunk (CodeMirror, jsx6 runtime, LSP assets,
preview runtime) with a stable URL and a `vendorHash` derived from it; the app shell imports that vendor
asset. If the bundler inlines them, an app-only edit re-downloads the libraries and the whole strategy
fails. `vendorHash` changes only when the vendor entry changes (dependency/version change), which is
exactly what triggers the full reload.

The service worker is **part of the app**, not an optional add-on: the dev server serves it at the app
scope, and the client registers it before the first expensive asset request. It must be safe to run in
development, with a documented reset path.

#### 4.13.2 Update protocol

1. `install`: precache the shell + vendor manifest; do not activate over a live session without a
   handshake.
2. `activate`: delete cache names not in the current manifest; `clients.claim()` only after the client
   accepts the update (or immediately in dev, configurable).
3. The client asks `sw-manifest.json` for the current `buildId` / `vendorHash` (network-only) and compares
   it with the running app.
4. If only `buildId`/`appHash` changed: send `{type:'refresh', scope:'shell'}`; the client snapshots
   state, soft reloads the shell, restores state, and reruns the preview if needed. **No vendor fetch.**
5. If `vendorHash` changed: show/persist a "libraries updated" marker, then do a full reload. That is the
   only case where the whole page reloads.
6. If only preview assets changed: `{type:'refresh', scope:'preview'}`; re-transform and swap the iframe
   without touching the shell.
7. `skipWaiting` is not unconditional. A background update must not silently replace the app under an
   active edit; the client decides when to apply, except in dev where an explicit reload is expected.

In development, every build changes `buildId`, so the flow is exercised continuously. The dev guide
documents `?sw=off`, unregister, cache clear, and how to test the vendor-change full reload deliberately.

#### 4.13.3 Routing and state

Routing is how refresh stays cheap:

- History API routes: `/` (scratchpad), `/edit/<file>`, `?view=code|structure|layout|focus`,
  `#L42`/`#L42:12` for a source location, `?focus=<source-range>`, `?panel=...`.
- Server route fallback to the app shell; the service worker also serves the shell for a navigation when
  the network is unavailable. The same URL is usable from an IDE host or a graph/doc page.
- State to persist: current file/route, cursor and selection, scroll offsets (editor and preview), active
  view/focus, panel sizes/collapsed ranges, selected DOM element, preview scroll, recent files.
- Persist in `localStorage` (durable, per project) or `sessionStorage` (per tab) with a schema version;
  large snapshots (ASTs, transformed code) are **not** stored — store identifiers/ranges and reparse.
- Restore in a pre-paint phase (`requestAnimationFrame`/layout effect) so the first frame is already in
  the right place; no visible scroll jump or editor flash.
- Deep-link a source location from the host/visual modes; the route is the single source of truth for
  "where the user is".
- Preview application state is **not** promised across a full reload. Template/CSS refresh keeps the
  iframe when possible; a full reload resets the preview app. That limitation is documented rather than
  hidden behind a state-sharing mechanism.

#### 4.13.4 Service worker and the IDE webview

Service workers need a secure context and a same-origin scope. The standalone app is served from
`localhost`, so it is fine. In IDE webviews (JCEF, VS Code Electron, Eclipse SWT/WebView2), registration
may be restricted or shared with the IDE origin. Rules:

- feature-detect; if registration fails, run without a service worker and fall back to the server's
  cache headers (`no-cache` for the shell, immutable for `/vendor/*`).
- never register a service worker from an opaque/cross-origin iframe; the jsxed page must be served from
  the jsxed origin for caching to apply.
- the dev guide records the per-host behavior and the fallback; a missing service worker must not break
  the editor.

#### 4.13.5 Research and dev guide deliverables

- `apps/jsxed/doc/service-worker.md` — cache model, update protocol, scope/secure-context rules,
  debugging (`Application → Service Workers`, cache storage), how to reset, how to test a vendor bump,
  and the IDE-webview caveats.
- `apps/jsxed/doc/refresh-dev.md` — how to exercise soft shell refresh, preview refresh, CSS swap and
  full vendor reload; what must be measured; known traps (stale manifest, double controllers, update
  loops).
- Research spikes in P0/R0: hand-rolled SW vs Workbox (default: hand-rolled, no new dependency),
  navigation preload/streams, cache quota/eviction, storage APIs for state, and SW behavior in each IDE
  webview.
- The dev guide is a **deliverable of R0/R1**, not a documentation afterthought.

#### 4.13.6 Performance targets

- warm reload to interactive < 150 ms (provisional; measure in P0/P1);
- app-only update: **0 library bytes** downloaded;
- preview-only refresh < 300 ms;
- CSS swap applied before the next paint when possible;
- no visible cursor/scroll jump on state restore;
- full reload only on `vendorHash` change (or an explicit reset).

Measure with the Performance API and the browser's cache/SW panels, and record numbers in the phase
summary. A "smooth" claim without these numbers is not accepted.

#### 4.13.7 Refresh track

| step   | when | deliverable                                                                | exit criterion                                                                 |
| ------ | ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **R0** | P0   | SW research, manifest/hash design, dev-guide skeleton                      | cache names/hashes designed; dev guide exists; no SW behavior yet              |
| **R1** | P1   | register SW, cache shell + vendor, router + state restore                  | warm reload restores state and fetches no vendor bytes; shell refresh works    |
| **R2** | P2   | preview refresh (template/CSS), update protocol, vendor-change full reload | template/CSS updates without shell reload; vendor bump is the only full reload |
| **R3** | P3   | IDE-webview fallback, offline/navigation fallback, performance benchmarks  | works without SW in a webview; budgets recorded                                |

HMR-class UX is delivered by R1–R2; no module-graph code is introduced.

---

## 5. Phased plan

Each phase ends with a demonstrable outcome, not a feeling.

### P0 — Spike: editor + preview + source↔DOM

**Build**

- Scaffold `apps/jsxed` with a Bun app server (static files, `/transform`) plus the esbuild app bundle.
- CodeMirror with JSX highlighting, line numbers, history, search, completion keymap.
- One sample component; server-side esbuild transform with `jsxDev` + iframe preview.
- Read `_source`, build the source↔DOM index, implement caret→preview outline and Alt+click→source
  selection.
- Minimal Structure panel (list of JSX nodes) and error display.
- **H0:** `HostBridge` interface + a fake/builtin adapter and `DocumentSession` mode; `--project` for the
  server. No live host calls yet.
- **H1 spike:** prove the webview-owned **standalone editing backend** can be reused/extracted; run one
  open/read/save/watch against a throwaway project. This is a go/no-go for the hard requirement, not a
  polish item.
- **R0:** service-worker research, manifest/hash design (`buildId`, `vendorHash`, cache names), and the
  `doc/service-worker.md` skeleton.
- Record measurements: server transform time, iframe run time, source-map accuracy.

**Exit criteria**

- [ ] `cd apps/jsxed && bun run start` serves the editor; `bun run build` succeeds.
- [ ] `cd apps/jsxed && bun test` passes (pure tests: line/offset mapping, index queries, transform endpoint).
- [ ] A component with a function component, a `JsxW` class, a `Loop` and a shadow-root component renders.
- [ ] Caret in a JSX element outlines the matching DOM; Alt+click selects the source range.
- [ ] Loop duplicates are reported as one-to-many, not as a wrong single node.
- [ ] A transform error and a runtime error each show a useful location.
- [ ] Killing the app server leaves the editor usable and reports the preview as unavailable.
- [ ] The fake `HostBridge` can open/read/apply through the same `DocumentSession` API as the builtin mode.
- [ ] H1 spike shows the webview-owned standalone backend can serve a sample project without a jsxed host
      fork; the extraction/consumption path is recorded.
- [ ] R0 leaves a manifest/hash design and a service-worker dev-guide skeleton in the tree.
- [ ] `plan/jsxed-p0-findings.md` records the numbers and the limitations.

**Decision gate:** if `_source` cannot be made reliable for components/fragments/loops, stop and fix the
mapping approach before building more views.

### P1 — Standalone editing backend (hard requirement)

**Build**

- **H1:** extract/consume the webview-owned **standalone editing backend**. This is the hard prerequisite
  for editing; it is not an IDE plugin and does not require LSP.
  - webview owns the host core: `/health`, `/open`, `/file`, `/api/v1/*`, port/token, path jail, atomic
    writes/checkpoints, watch. jsxed consumes it through the frozen contract; it does not fork it.
  - jsxed's file session: open a project file, read text + digest through the backend, edit in CodeMirror,
    save via `applyEdit` (`target: disk` in the standalone backend, or `buffer` when an editor host is
    attached), watch changes, use backend checkpoints for undo/redo.
  - `DocumentSession.liveSource` starts with `host-file` (and `builtin` for scratchpad); `host-buffer` and
    `lsp` are later.
  - backend discovery/auth/project-root: `host.json` → `/health`, token server-side, `--project`; no token
    in page JS; a missing backend leaves the scratchpad usable.
- **R1:** register the service worker, cache shell + vendor immutably, add History-API routing and
  pre-paint state restore.
- Completion remains the CodeMirror/JSX6 fallback; **no LSP client, no TS service** in P1.
- Dev guide for backend integration: how to start it, token/project setup, save/undo/watch behavior, and
  what to do when it is absent.
- Baselines: file open/read/save latency, warm reload, state restore.

**Exit criteria**

- [ ] `bun start` + the webview-owned standalone backend opens a project file, reads it, saves an edit
      atomically, watches a change and undoes the saved edit.
- [ ] jsxed never writes the project file directly; every save goes through the backend.
- [ ] Path jail, token/auth and project-root checks are enforced by the backend and exercised from jsxed.
- [ ] With the backend absent, jsxed falls back to the scratchpad and clearly says so.
- [ ] A source edit updates the preview without a shell reload.
- [ ] Warm reload restores cursor/scroll/view and downloads **zero** vendor bytes; shell refresh works.
- [ ] `tsc` is not invoked for jsxed source; no LSP is involved.
- [ ] File-open/read/save/watch timings are recorded.

### P2 — Viewing modes

**Build**

- Structure outline with selection sync and breadcrumbs.
- DOM tree with tag/class/component labels and computed boxes.
- Layout overlay (boxes, labels, container emphasis).
- Focus mode (dim/collapse, optional freeze), keyboard toggles, persisted mode.
- JSX-aware folding: collapse a JSX element to a one-line summary.
- Read-only `StyleIndex` lookup for matching CSS rules/classes on the selected element (future CSS
  scaffolding; no CSS editing).
- **R2:** preview refresh (template/CSS), SW update protocol, CSS swap without shell reload, and the
  vendor-change full-reload path.

**Exit criteria**

- [ ] Each mode answers its question in a 10-second manual test on a non-trivial component.
- [ ] Switching modes never changes the document or loses undo history.
- [ ] Focus/freeze has an obvious exit and cannot trap the user.
- [ ] Overlay stays aligned after scroll, resize and re-render.
- [ ] `StyleIndex` reports matching rules/classes for the selected element from a linked stylesheet; there
      is no CSS editing path in P2.
- [ ] A template or CSS change refreshes the preview without reloading the jsxed shell; a vendor-version
      change is the only case that forces a full reload.

### P3 — JSX6 intelligence beyond TS

**Build**

- Component/custom-element/attribute/directive/signal/`p`/CSS completion providers.
- JSX6 diagnostics and a few quick fixes.
- Rich completion info rendered with JSX6 (mini preview or attribute table).
- **H2:** host read/edit/watch + guest-editor mode: `/file` + digest, optional `readBuffer` when the host
  advertises it, diff/apply into the host buffer, `409 stale` recovery, save-event refresh; no direct
  disk write.
- **R3:** service-worker fallback for IDE webviews, offline/navigation fallback, and the refresh
  performance benchmarks.
- Optional: component lens and live state panel.

**Exit criteria**

- [ ] The beyond-TS checklist in §4.9 works on the corpus.
- [ ] Ranked results do not bury TS items; duplicate labels are merged sensibly.
- [ ] Completion info rendering does not leak nodes/listeners between items.
- [ ] Diagnostics have tests for each rule and a way to disable them.
- [ ] In guest-editor mode, a jsxed proposal lands in the host buffer with the host's undo, and a stale
      digest produces a re-read rather than a blind retry; jsxed never writes disk in this mode.
- [ ] A host save event refreshes the preview without losing the current selection.
- [ ] In an IDE webview without service-worker support, the app still loads and refreshes via server cache
      headers; the performance numbers are recorded.

### P4 — Dogfood and packaging

**Build**

- Use jsxed (S2) to develop at least one jsxed UI component; document the workflow.
- README, dev-server instructions, app-local build/test scripts, and links to the service-worker/refresh
  dev guides from R0/R1.
- **H3 (if the webview-owned standalone host is extractable):** implement the `EditorHost` adapter and
  integrate it with that host; do not add host routes or a second auth model to jsxed.
- Keep the package private through P2/P3; decide on publication and a static/browser mode after the
  server-assisted workflow is proven.

**Exit criteria**

- [ ] A real jsxed UI change was made in jsxed and committed.
- [ ] The app builds from a clean checkout and runs from `build/` with the app server.
- [ ] Root `bun run check` is green (with `--no-format` in the confined sandbox).
- [ ] If H3 was attempted, the webview-owned standalone host opens/edits jsxed through the `EditorHost`
      adapter; host conformance is upstream-owned and jsxed has no host routes of its own. Otherwise the
      host-mode decision is recorded.
- [ ] The plan's decision log records the LSP/transform/self-host/host-integration outcomes.

### P5 — LSP and autocomplete (last)

**Build**

- `@codemirror/lsp-client` with a connection factory over two transports:
  - sidecar WebSocket (`/lsp` proxy → TS 7-native LSP if usable; TS 7-based fallback only);
  - optional browser worker: TypeScript LSP (TS 7 if browser-capable, else optional TS 6 asset) or
    JSX6-only LSP when TypeScript is disabled.
- Type bundle (lib d.ts + `@jsx6` d.ts + JSX6 JSX d.ts) shared by the sidecar and the optional TypeScript
  worker.
- Completion, hover, syntax diagnostics, definition.
- **H4:** LSP live-buffer channel (`didOpen`/`didChange` + `workspace/applyEdit`) as the second
  `liveSource`, so live unsaved text works without a host buffer-read route.
- Baseline corpus and benchmark against Monaco.
- The editing backend, host integration, refresh and visual modes must all work with LSP **off**.

**Exit criteria**

- [ ] Completion for plain JS and JSX is useful with no noticeable typing delay.
- [ ] The expected item is in the top 10 for at least 90% of the corpus (record the exact number).
- [ ] Hover shows JSDoc and TS types; diagnostics do not fire on valid JSX6 samples.
- [ ] The sidecar can be stopped and restarted without reloading the app; the editor remains usable.
- [ ] The optional worker path is exercised with TypeScript completion/hover when the sidecar is off, or
      with JSX6-only completion when TypeScript is disabled.
- [ ] `tsc` is not invoked for jsxed source in the app build or test path.
- [ ] H1/H2/H3 editing still works with the LSP disabled.
- [ ] If H4 is enabled, `liveSource: lsp` receives unsaved `didChange` text, edits go through
      `workspace/applyEdit`, and switching back to host/builtin does not double-apply an edit.
- [ ] p95 completion latency, sidecar startup, worker startup and asset sizes are recorded.

---

## 6. Dependencies

### 6.1 Candidates

| package                                                                 | role                                       | status                | notes                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------- |
| `@codemirror/state`, `view`, `language`, `commands`                     | editor core                                | new                   | current 6.x; add to root catalog if shared                                                         |
| `@codemirror/autocomplete`, `lint`, `search`                            | completion/lint/search UI                  | new                   |                                                                                                    |
| `@codemirror/lang-javascript`                                           | JS/JSX Lezer language, fallback completion | new                   | 6.2.5 current at the time of writing                                                               |
| `@codemirror/lsp-client`                                                | official LSP client                        | new                   | 6.3.0 (2026-09-17); transport abstraction; WebSocket and worker both fit the `Transport` interface |
| `@lezer/highlight`                                                      | highlight tags                             | new                   |                                                                                                    |
| `esbuild`                                                               | server-side transform/bundle               | existing catalog      | transform endpoint and app build; `jsxDev` source info verified on 0.17.18                         |
| `@babel/parser`                                                         | server-side structure summary              | new (server only)     | parse JSX elements/ranges without running a Babel transform                                        |
| `@typescript/native-preview` / `tsgo`                                   | TS 7-native LSP sidecar                    | preferred (verify)    | use it if a stable `--lsp` mode is available; not a build/check step                               |
| `typescript-language-server`                                            | LSP sidecar fallback                       | conditional           | only if it runs on TypeScript 7; otherwise not used                                                |
| `vscode-jsonrpc`                                                        | LSP framing helper                         | candidate (server)    | proxy framing and/or a minimal H4 server; not an app bundle dependency                             |
| `vscode-languageserver`                                                 | LSP server framework for H4                | candidate (server)    | only if a minimal hand-rolled server is not preferable; Node/Bun side                              |
| jcodebuddy webview host API                                             | editor cooperation contract                | external, no package  | `open`/`file`/`edit`/`events`; discover via `host.json` + `/health`; use the frozen contract       |
| `webviewd`                                                              | headless integration fixture               | test-only             | drives the HTTP contract in tests without an IDE                                                   |
| webview-owned standalone host core                                      | standalone "IDE half"                      | external (webview)    | maintained/extracted in webview; jsxed supplies the `EditorHost` adapter, never a host fork        |
| Service Worker + Cache Storage                                          | asset caching/refresh                      | platform built-in     | hand-rolled SW first; Workbox only a research comparison                                           |
| `localStorage` / `sessionStorage` / IndexedDB                           | route/session state                        | platform built-in     | no state library; schema-versioned, small snapshots only                                           |
| webview conformance vectors                                             | host security/behavior tests               | external data         | `conformance/bridge-decisions.json`; use them if jsxed acts as host                                |
| `typescript` (7.x)                                                      | tooling only                               | existing root devDep  | declaration emit and possible sidecar; never an app dependency or bundle entry                     |
| `typescript` (6.x, aliased)                                             | optional LSP worker asset                  | optional              | only if no browser-capable TS 7 exists; LSP-only; no `tsc`, no build/check, not app code           |
| `@typescript/vfs`                                                       | TS worker host helper                      | optional              | only with the optional TS worker; a small host may be enough                                       |
| `@babel/standalone`                                                     | REPL transform / fallback                  | existing (repl only)  | not used by jsxed's default path; keep the REPL working as-is                                      |
| `preventInfiniteLoops`                                                  | guard user loops                           | existing (repl)       | server-side pre-pass only if the iframe timeout proves insufficient                                |
| `esbuild-wasm`                                                          | future static-mode transform               | alternative           | relevant to S4/static mode, not v1                                                                 |
| `@jsx6/jsx6`, `signal`, `w`, `jsx-dev-runtime`, `dom-observer`          | app + preview stack                        | existing              | workspace `*`                                                                                      |
| `@jsx6/loop2`, `popover`, `virtual-scroll`                              | optional UI/preview pieces                 | existing              | only if a real need appears                                                                        |
| `@jsx6/build`, `esbuild`                                                | bundle/static helpers                      | existing              | app build; the dev server is a small Bun.serve (no `live-server` requirement)                      |
| `happy-dom`, `@happy-dom/global-registrator`, `bun-types`, `@types/bun` | tests/types                                | existing              | CodeMirror view tests are browser-only                                                             |
| `prettier`                                                              | formatting                                 | not planned           | CodeMirror has no formatter; a separate decision                                                   |
| `html-element-attributes`                                               | HTML attribute metadata                    | candidate             | only if generating the JSX d.ts from data                                                          |

### 6.2 Dependency policy

- **Catalog first.** Shared third-party versions go into the root `catalog` and are consumed with
  `catalog:`; this keeps the gate's version-drift check quiet. If `@babel/standalone` remains a REPL-only
  dependency, jsxed does not need to share it.
- **No TypeScript in app code or build/check.** jsxed's `dependencies` must not contain `typescript`; the
  app/preview bundle must not import it; no `tsc` runs for jsxed source. TypeScript is allowed only for
  LSP/tooling: the existing TypeScript 7 devDependency for library declaration emit, the TS 7 sidecar, and
  an optional browser TS worker.
- **TypeScript LSP may be worker or sidecar.** Prefer TS 7 in both. A worker can use the optional TS 6
  language-service asset when no browser-capable TS 7 exists, but that asset is LSP-only and never used to
  compile or check the app. It is a build-time/vendored asset, not a manifest dependency of
  `apps/jsxed`. If the worker has no TypeScript engine, it serves JSX6 language features only.
- **The server is part of the app, not a hidden build step.** `/transform` and `/lsp` live in the Bun
  server, start with the app, and fail visibly. They are local-only.
- **Consume the webview contract, do not fork it.** Host discovery, tokens, path jail, rate limits and
  edit routing belong to the host. jsxed only calls `open`/`file`/`api/v1` with capability detection. If a
  webview-owned standalone host later drives jsxed, that host keeps auth/conformance and jsxed supplies
  only the `EditorHost` adapter; jsxed does not grow a second host implementation.
- **In guest mode the host owns the bytes.** No direct disk writes, no second undo stack, no token in page
  JavaScript; the Bun server holds the token and proxies host calls.
- **The webview contract is external, not a package dependency.** jsxed uses `fetch`/`EventSource` and a
  small server-side client; it does not vendor a host implementation or copy its security decisions.
- **The service worker is part of the app, not an optimization add-on.** Hand-rolled first (no Workbox
  dependency), vendor assets immutable, app/preview assets revalidated, API routes network-only. Its dev
  guide and cache-reset path are deliverables, not documentation afterthoughts.
- **No React, no Monaco, no `@types/react`.** Monaco stays in `libs/editor-monaco` for the REPL; jsxed
  does not use it.
- **No second `@jsx6/jsx6` in the top realm.** The preview gets its own copy inside the iframe; that is a
  separate realm. If the preview ever moves into the top document, this rule becomes a blocker.
- **Lazy assets are first-class.** The app shell must be useful before the sidecar or the optional worker
  is fetched. Build a version-stamped asset directory and load them only on demand.

### 6.3 Asset and size strategy

- App bundle: CodeMirror + app + lightweight JSX6 UI.
- Bun server: `/transform` (esbuild, `@babel/parser` for structure) and `/lsp` (WebSocket ↔ stdio proxy);
  static files.
- Sidecar: TypeScript 7 language server child process, started lazily; its type bundle is built locally.
- Optional browser worker: TypeScript LSP (TS 7 if browser-capable, else optional TS 6 asset) or JSX6-only
  language server when TypeScript is disabled. Loaded only on opt-in.
- Preview iframe: self-contained bundle returned by `/transform`; no require shim.
- `static/vendor/` is generated and version-stamped for the optional worker asset.
- Provisional budgets (measure in P0/P1 and replace):
  - editor shell < 600 KB gzip;
  - interactive without language service < 1.5 s warm;
  - sidecar language service ready < 3 s warm;
  - p95 completion < 150 ms;
  - p95 server transform < 150 ms;
  - p95 preview rerender < 500 ms.

---

## 7. Open questions

### 7.1 Answered 2026-10-21

| #       | answer                                                                   | consequence                                                                                  |
| ------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **Q1**  | **Hybrid from day one.**                                                 | The app gets a WebSocket transport (default) and a worker transport behind one interface. The sidecar is the normal path; the worker is optional. |
| **Q2**  | **TypeScript LSP may be worker or sidecar; never build/check/app code.** | Prefer TS 7. A worker may use the optional TS 6 LSP asset if no browser-capable TS 7 exists. No `tsc` compile/check for jsxed. |
| **Q3**  | **Server-side Bun/esbuild.**                                             | The Bun server owns `/transform`; the client has no Babel dependency. Source mapping relies on esbuild's `jsxDev`. |
| **Q4**  | **Single-file scratchpad + preview + sync.**                             | One `main.jsx`, one iframe, one language document. Multi-file stays out of v1.               |
| **Q5**  | **Edit jsxed's own UI components in a dev workspace (S2).**              | P4 must demonstrate opening and previewing real `src/` components, not just demos.           |
| **Q6**  | **Private until P2/P3.**                                                 | `apps/jsxed` stays `"private": true`; no versioning/manifest/release work until the architecture settles. |
| **Q14** | **Use both live-buffer channels, one active at a time.**                 | `liveSource` priority: LSP `didChange` → host `readBuffer` → host `/file` + events → builtin. One edit channel per session; reset revision on switch. |
| **Q17** | **Live unsaved host text is a goal, not an optional extra.**             | LSP is the editor-agnostic path; host buffer-read is the webview-host path. Save-synced file mode remains the fallback. |
| **Q15** | **Standalone host core is webview-owned; jsxed only adapts its editor.** | No fork of HTTP/auth/port/conformance; H3 is deferred until the webview standalone host can be extracted/reused. |
| **Q21** | **No module HMR; fast refresh + state restore instead.**                 | Template/CSS edits refresh the preview; shell updates soft-reload; full reload only on vendor change. |
| **Q22** | **Service worker is integral; vendor libraries are immutable cache.**    | Hand-rolled SW; app/preview assets revalidated; API/transform/LSP routes network-only.       |
| **Q23** | **Routing + persisted state are part of the refresh design.**            | URL is the location source; cursor/scroll/view/panels restore before paint.                  |

Q2 was clarified in two passes: TypeScript may power the LSP in either a worker or a local server, but it
is never used to compile/check jsxed source or as an app dependency. TS 7 is preferred everywhere; TS 6 is
allowed only as the optional LSP worker asset when no browser-capable TS 7 exists.

The language-service implementation is **P5**. The transport/document-sync interfaces are scaffolded in
P0/P1 so LSP can be added without restructuring, but editing, file I/O, refresh and visual modes must work
with the LSP off.

### 7.2 Still open

| #   | question                                                  | why it matters                                                                     | options                                                                              |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Q7  | Target browsers?                                          | Workers, module workers, iframe sandboxing and CodeMirror all need a baseline.     | evergreen Chromium/Firefox/Safari assumed until told otherwise                       |
| Q8  | Where do intrinsic HTML attribute typings come from?      | TS has no built-in JSX HTML namespace; React types are not an option.              | generate from `lib.dom.d.ts`; hand-author; metadata package; no types at first       |
| Q9  | Persistence/sharing beyond the session?                   | Session state/routing is settled; export, file open/save and share links are not.  | export file; open/save via host; share URL; local-only                               |
| Q10 | Public demo or local tool?                                | Executing user code is a security decision, not just hosting.                      | local-only; dedicated-origin demo; no public execution                               |
| Q11 | Formatting?                                               | CodeMirror has no formatter; Prettier is a new dependency and a JSX parser.        | none in v1; Prettier later; custom minimal                                           |
| Q12 | How much LSP surface?                                     | Rename/references/code actions are significant work and need multi-file semantics. | completion/hover/diagnostics first; add definition/symbols; full later               |
| Q13 | Which host gets H1/H2 first?                              | IDE APIs and capabilities differ; testing all three is expensive.                  | JetBrains; VS Code; Eclipse; headless `webviewd` first                               |
| Q16 | How does the jsxed server learn the project root?         | Host discovery and path jail need the same project the IDE serves.                 | CLI `--project`; env var; query from the host/page; default cwd                      |
| Q18 | How is the host token supplied when `tokenPath` is empty? | VS Code keeps the token in editor settings; writes then fail closed.               | `--host-token`/env; mirror setting to jsxed; navigation-only until configured        |
| Q19 | How should CSS be mapped to source?                       | CSSOM gives matching rules, not source offsets; source maps are rare.              | read-only CSS index now; CSS parser + source maps later; CSSOM-only for cross-origin |
| Q20 | How does a running app expose provenance?                 | `_source` exists, but a bundled app needs source maps and an app entry.            | app injects `_source`; esbuild source maps; runtime bridge later; no v1 app mode     |

Provisional host order for H1/H2: use headless `webviewd` to lock the HTTP contract first, then JetBrains
(JCEF, `open`/`select`/`edit`), then VS Code (`open`/`edit`); Eclipse after the first two. This is a test
order, not a promise of equal capability coverage.

---

## 8. Risks

| risk                                                   | impact                                        | mitigation                                                                                    |
| ------------------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Sidecar process life / port conflicts                  | no completions, stale process                 | lazy start, status UI, bounded restart, one child per session, kill on server exit            |
| Server-side transform is a new failure mode            | preview unavailable without the server        | explicit "preview unavailable" state; editor still works; static mode later                   |
| esbuild `jsxDev` source shape differs from expectation | source mapping/selection broken               | P0 verifies fileName/line/column; fallback to AST range + heuristics; tests                   |
| JSX6 d.ts surface is too weak                          | TS completions/diagnostics are noisy or wrong | start with syntax + JSX6 rules; author a JSX namespace; grow from the corpus                  |
| `_source` is unreliable for fragments/loops/components | visual sync lies                              | P0 gate; approximate labels; map via AST + nearest source-bearing node                        |
| esbuild transform/source positions drift               | selections off by lines                       | compare AST ranges and `_source` in tests; pin esbuild; test multi-line JSX/comments          |
| iframe flicker/leaks                                   | preview feels broken                          | double-buffer frames like `FlipFrame`; full reload per run; dispose old frame                 |
| sync infinite loop freezes the preview                 | no `preventInfiniteLoops` in esbuild path     | iframe timeout + stop/reload; optionally a server-side pre-pass; document the limit           |
| two jsx6 copies                                        | `JSX6E15`, broken scopes                      | iframe realm isolation; bundle audit; no top-level user code                                  |
| CodeMirror/happy-dom incompatibility                   | visual features untested in CI-less repo      | unit-test pure state/index; browser smoke; do not force view tests into happy-dom             |
| Scope creep in viewing modes                           | never reaches LSP parity                      | P0/P1 gate first; modes are projections of one index; timebox each mode                       |
| Security expectations                                  | local demo could be exposed                   | local-only server; document "own code" model; no multi-tenant claims                          |
| No usable TS 7 LSP                                     | no semantic completions/hover                 | P1 spike verifies TS 7-native LSP; optional TS 6 worker LSP or JSX6/Lezer fallback            |
| TS 6 worker vs TS 7 sidecar divergence                 | inconsistent results                          | same type bundle/corpus tests; worker is optional; no `tsc` build/check                       |
| Host buffer-read gap                                   | preview shows saved state, not unsaved edits  | document the limit; apply jsxed edits locally; save-event refresh; LSP/buffer route later     |
| Host capability drift                                  | buttons that do nothing                       | capability-gate every action; test against live hosts; hide unsupported verbs                 |
| Stale `host.json`                                      | dead or wrong endpoint                        | always probe `/health`; check `project`; treat a stale record as no host                      |
| Host rate limit (20/20 s)                              | open/edit refuses with 429                    | trigger only on explicit actions; debounce; surface the status                                |
| Cross-origin webview injection unavailable             | `window.openFile` missing in jsxed page       | use HTTP `/open`; do not depend on VS Code `postMessage` conventions                          |
| Two owners / double undo                               | lost buffer or two histories                  | `DocumentSession` owner; host buffer edits only; never direct disk in guest mode              |
| LSP + host text disagree                               | split-brain preview or double edit            | one active `liveSource`; reset revision on switch; one edit channel; never mix digest/version |
| Host token exposure                                    | local secret leaks to page JS                 | token stays in Bun server; browser calls jsxed proxy; no token in URLs/logs                   |
| Host token not discoverable (`tokenPath` empty)        | read/edit cannot authenticate                 | explicit `--host-token`/env; navigation-only until configured; no scraping settings           |
| Wrong project host                                     | wrong file or 404s                            | compare `/health.project`; pass `--project`; refuse mismatch                                  |
| Standalone host fork                                   | a second, weaker auth model                   | host core stays webview-owned; jsxed provides only `EditorHost`; defer H3 if not extractable  |
| Bundled app lacks usable source maps                   | `_source` points at bundle, not source        | require/validate esbuild source maps before app mode; keep `SourceRef` file-aware             |
| CSS source mapping is approximate                      | CSS edit lands on wrong range                 | read-only CSS index in v1; add CSS parser/source maps before any CSS edit                     |
| Future app mode drifts into module HMR                 | large bundler/module-graph scope              | explicit non-goal; fast refresh via cache + state; template/CSS edit → refresh                |
| Multi-file scaffolding becomes multi-file editor       | scope explosion                               | one document per session in v1; file-aware data model only                                    |
| Service worker serves stale shell                      | old app under a new manifest                  | versioned cache names; no-cache manifest/SW; update handshake; dev reset path                 |
| SW update loop / double controller                     | repeated reloads                              | single `buildId` compare; no unconditional `skipWaiting`; debounce update messages            |
| SW unavailable in IDE webview                          | no cache/refresh path                         | feature-detect; server cache headers fallback; dev guide records per-host behavior            |
| Cache quota / eviction                                 | vendor assets disappear, slow reload          | cache priority for vendor; handle quota errors; revalidate app assets                         |
| State schema drift or corrupt snapshot                 | wrong restore / crash                         | schema version; validate; drop-and-reset; never store ASTs or secrets                         |
| Full reload loses preview app state                    | perceived HMR gap                             | document; keep iframe alive for template/CSS refresh; only full reload on vendor change       |
| No CI                                                  | regressions land silently                     | app-local tests/build in the phase exit criteria; root gate; manual browser checklist         |

---

## 9. Verification and metrics

### 9.1 Tests

- **Pure unit tests** (Bun):
  - line/column ↔ offset conversion, CRLF and non-ASCII;
  - structure summary from the server parser (ranges, tags, attrs, `define()`, signals);
  - source↔DOM index queries, including one-to-many loops and approximate fragments;
  - transform endpoint: valid JSX, syntax error, import error, source map/source locations;
  - LSP offset/position conversion and completion mapping;
  - JSX6 completion providers and diagnostics rules;
  - persistence/serialization;
  - future-scaffold checks: `SourceRef.file` is not hardcoded to `main.jsx`; a `src/Foo.jsx` source and an
    `assets/app.css` stylesheet can be indexed; `StyleIndex` matches a class/selector without editing CSS.
- **Server integration** (Bun):
  - `/transform` returns runnable code and structure for the corpus;
  - `/lsp` proxy starts/restarts the sidecar and forwards initialize/completion/diagnostics;
  - process cleanup on server shutdown.
- **Host integration** (Bun + a real `webviewd`/IDE host when the sibling checkout is available; the
  fake bridge covers the seam otherwise):
  - discovery from `host.json` → `/health` → token, including stale descriptors and project mismatch;
  - `/open` 200/400/403/404/405/429 handling and the injected `window.openFile` fallback;
  - `/file` digest, optional `readBuffer` capability, `/api/v1/diff` → `/api/v1/applyEdit target=buffer`,
    stale 409 recovery, no-buffer-edit / no-disk-write refusals;
  - `/api/v1/events` refresh, or focus refresh where watch is unavailable;
  - `liveSource` priority LSP → host-buffer → host-file → builtin; switching sources resets revision and
    never double-applies an edit;
  - LSP `didOpen`/`didChange` text reaches the preview; `workspace/applyEdit` is the only edit channel
    while LSP is active;
  - no token in page JS and no direct disk write in guest mode;
  - if a webview-owned standalone host drives jsxed: the `EditorHost` adapter opens/edits the internal
    buffer and the host's own conformance tests pass (jsxed does not re-test host auth).
- **Browser smoke** (`smoke/*.run.mjs` or a headless Chrome probe):
  - app boots, editor renders, preview renders;
  - caret→DOM and Alt+click→source;
  - modes switch without document changes;
  - sidecar down → editor remains usable; optional worker path opt-in.
- **Service worker/refresh** (browser, real SW):
  - first load registers and precaches shell/vendor; cache names include `buildId`/`vendorHash`;
  - warm reload restores cursor/scroll/view before paint and downloads zero vendor bytes;
  - app-only update soft-refreshes the shell; preview-only update swaps template/CSS without shell reload;
  - vendor-hash change is the only full reload; old caches are deleted;
  - `/transform`, `/lsp`, `/api/*`, `/host/*` are never cached;
  - SW unavailable (or `?sw=off`) falls back to server headers and still works.
- **Manual checklist** per phase, recorded in the phase summary. For H1/H2, run the host's own
  observation checklist rather than claiming IDE support from a unit test;
  [ide-observation-checklist.md](../../java/jcodebuddy/webview/doc/ide-observation-checklist.md) is the
  reference.

### 9.2 Benchmarks

- Server transform time and iframe run time per sample.
- Sidecar startup, first completion, p50/p95 completion; optional worker startup separately.
- Host discovery (`host.json` → `/health`) time, `/open` round trip, `/file` read, apply-edit round trip,
  event-to-preview refresh.
- SW: first install, warm reload to interactive, state-restore time, vendor bytes on app-only update,
  preview refresh, CSS swap, cache hit ratio, old-cache cleanup.
- Source-map accuracy rate on the corpus.
- Bundle sizes: app shell, server, sidecar process memory, optional worker bundle.

### 9.3 Gate notes

- Add `apps/jsxed` to the workspace by directory; no root script change is needed for discovery.
- `apps/jsxed` scripts must not call `tsc`; no TypeScript compile/check step for the app. The LSP is the
  only place TypeScript runs.
- Apps are not linted by the root `oxlint` invocation (`libs tools scripts`); keep the app's own style
  clean anyway.
- If the app is published, register it in `scripts/versions.json` / `MODULE_VERSIONING.md` and give it a
  README, `files`, `exports` and version; otherwise keep it private through P2/P3 (the Q6 decision).
- Browser checks depend on the sandbox: under confined file policy headless Chrome may not start. Record
  that as an environment limitation, not a product failure.
- The transform endpoint and app build use esbuild's JS API. In a confined sandbox that API can fail with
  `spawn EPERM`; use an unrestricted run or the esbuild CLI for verification, and do not mistake it for an
  app bug.
- Webview-host integration tests belong to jsxed's own suite and the sibling webview checkout, not to the
  jsx6 root gate; the root gate must not start an IDE or a `webviewd` process.
- Service workers cannot be exercised by `bun test`; run the browser smoke with a real SW, and serve
  `sw.js`/`sw-manifest.json` with `no-cache` while `/vendor/*` is immutable. The dev guide must include
  the reset procedure before the first R1 commit.

---

## 10. P0 acceptance script (what "the spike works" means)

Using a sample that contains a function component, a `JsxW` component, a `Loop`, a shadow-root component
and a conditional branch:

1. Run `bun start`; open jsxed; the sample renders in the preview on first load.
2. Type a new element inside the JSX; after the debounce the preview updates; no page reload.
3. Put the caret inside the element; the matching preview element gets an outline.
4. Alt+click a preview element; the editor selects the corresponding JSX source range.
5. Open Structure; the tree matches the source nesting; clicking a node syncs both panes.
6. Introduce a syntax error; the error panel points at the line; fix it; the preview recovers.
7. Introduce a runtime error; the panel shows the component/line; the editor remains usable.
8. Switch to Focus on one subtree; everything else dims; Escape restores the full view.
9. Stop the app server; the editor still edits and reports that the preview is unavailable.
10. Exercise the fake `HostBridge` through `DocumentSession`: capabilities, open, read, and apply do not
    branch the standalone preview path.
11. Record: server transform ms, run ms, mapping accuracy, any element types that failed.

If steps 3, 4, 8 or 10 fail, do not proceed to the LSP phase; fix the mapping/view or document-session
foundation first.

---

## 11. Decision log

| date       | decision                                                                 | rationale                                                                                 |
| ---------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 2026-10-21 | Create `apps/jsxed`; CodeMirror 6; JSX6-only UI; no Monaco/React.        | Brief; keeps the app aligned with the stack and the dogfood goal.                         |
| 2026-10-21 | Source↔DOM mapping is the P0 foundation; visual modes follow it.         | Every visual feature depends on a trustworthy mapping.                                    |
| 2026-10-21 | TypeScript sidecar + JSX6 providers is the starting language layer.      | Small adapter; JSX6 data and rich previews already live client-side.                      |
| 2026-10-21 | Reuse `_source`/dev runtime and the REPL's double-buffered iframe.       | Proven in the repository; avoids re-solving live execution.                               |
| 2026-10-21 | TypeScript is LSP-only; no `tsc` compile/check for jsxed.                | Q2 clarified: TS may power worker or sidecar, but never app code or build/check.          |
| 2026-10-21 | LSP runs hybrid: sidecar default, browser worker optional.               | Answers Q1; keeps full fidelity locally while leaving an offline path.                    |
| 2026-10-21 | Worker may host a TypeScript LSP or JSX6-only features.                  | Hybrid stays; TS 7 preferred, TS 6 only as optional LSP asset; no app dependency.         |
| 2026-10-21 | Preview transform is server-side Bun/esbuild.                            | Answers Q3; removes client Babel/require plumbing and enables bundling.                   |
| 2026-10-21 | v1 is single-file only.                                                  | Answers Q4; keeps the LSP document model and persistence honest.                          |
| 2026-10-21 | Dogfood target is S2 (edit jsxed's own UI components).                   | Answers Q5; a concrete, testable milestone rather than a slogan.                          |
| 2026-10-21 | `apps/jsxed` stays private until P2/P3.                                  | Answers Q6; avoids release/manifest churn while the architecture moves.                   |
| 2026-10-21 | Host editors are a first-class mode; jsxed consumes jcodebuddy webview.  | G9; lets an IDE own editing/completion while jsxed provides preview and structure.        |
| 2026-10-21 | `HostBridge`/`DocumentSession` seam is H0 in P0.                         | Host integration must not be retrofitted around a CodeMirror-only document model.         |
| 2026-10-21 | Guest mode never writes disk; the host owns the bytes.                   | Preserves host buffer/undo and avoids two sources of truth.                               |
| 2026-10-21 | Standalone host core is webview-owned; jsxed provides the adapter.       | Avoids a second auth/host implementation; H3 waits on an extractable host.                |
| 2026-10-21 | Both live-buffer channels are planned; only one is active at a time.     | Host buffer-read for webview hosts, LSP push for editor-agnostic; no split-brain.         |
| 2026-10-21 | Future app editing is template/CSS edit + fast refresh, not module HMR.  | Keeps the north star a source-editing problem; avoids module-graph/hot-boundary scope.    |
| 2026-10-21 | Scaffold file-aware provenance and a read-only CSS index now.            | The future app/CSS use case must not require a second document/source model.              |
| 2026-10-21 | Service worker is integral; vendor assets immutable.                     | App/CSS refresh without re-downloading libraries; full reload only on vendor-hash change. |
| 2026-10-21 | Routing + pre-paint state restore are part of refresh.                   | Makes a reload feel like HMR without module-graph complexity.                             |
| 2026-10-21 | No module HMR; fast refresh is cache + state + preview rerun.            | Keeps scope on template/CSS editing and UX, not hot-boundary machinery.                   |
