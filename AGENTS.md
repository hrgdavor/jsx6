# AGENTS.md — jsx6

deliberately short: this file is injected into **every** request, so it holds only facts that are
always relevant. Task and directory knowledge lives elsewhere (§ Where the rest of the knowledge lives).

Bun-workspace monorepo: `libs/*` (publishable `@jsx6/*` packages), `apps/*` (`nodditor`, `repl`),
`tools/*`. There is **no CI** — the local gate is the only gate. Design notes and open work live in
`plan/`.

## The gate

```sh
bun run check        # full gate: tests, tsc, oxlint, oxfmt, versions, docs, manifests, workspace
bun run check:fast   # tests + JSDoc type check
bun run test         # tests only, discovered across every package
```

`README.dev.md` documents what each step does, the flags, lint scope, versioning and publishing —
read it there instead of duplicating it here.

## Sandbox limits that change how you verify (expected, not bugs)

- **Browser checks depend on the session's file policy.** Under the confined modes headless Chrome
  cannot start (crashpad and Chromium's IPC need named pipes/`OpenProcess`, both denied:
  `crash server failed to launch, self-terminating`), and `bun`/Node cannot spawn `git`/`cmd.exe` or
  capture piped stdio. With unrestricted file access Chrome runs fine, and a *measurable* browser check
  is then cheap: render a probe page with
  `chrome --headless=new --no-sandbox --disable-crash-reporter --hide-scrollbars --force-device-scale-factor=1 --window-size=W,H --screenshot=out.png --user-data-dir=<scratch> file:///…/probe.html`,
  decode the PNG with `node:zlib` (`inflateSync` + the PNG filter loop) and measure dark runs per row.
  Add **calibration bars of known width** to the page and report their measured widths — that is what
  makes the pixel numbers trustworthy. This is how the `worldWidth`/`non-scaling-stroke` policy was
  settled (see [plan/line-render-followups.md](plan/line-render-followups.md) §6.1): an HTML ancestor
  `transform: scale(4)` painted 8 px both with and without `vector-effect: non-scaling-stroke`, while an
  in-SVG transform painted 2 px with it.
- **`oxfmt --check` cannot pass here**: it exits 2 with `spawn EPERM` on six HTML files. Use
  `bun run check --no-format`, and `bun x oxfmt` (no args) to format — its **stdout** lists the source
  files that need formatting; the stderr HTML noise is the sandbox, not the tree.
- **`command 2>&1 | Select-String ...` fakes a non-zero exit** in PowerShell even when the command
  succeeded. Check `$LASTEXITCODE`, or redirect to a file and read it.
- **Do not rewrite text files through PowerShell.** Non-ASCII text in a `pwsh -Command` string goes
  through the ANSI code page, so a `Get-Content -Raw` → `Set-Content` round trip mixes encodings and
  can leave invalid UTF-8 (it happened to `plan/line-render-followups.md`). Use the file-editing tools;
  if a file does get mangled, the repair is a byte walk keeping valid UTF-8 and mapping stray bytes
  through CP1252, then re-check every file you touched. The same code page mangles *displayed* non-ASCII
  in `pwsh` output (`â€”` for an em dash) even when the file is fine — read files with the read tool
  before concluding an encoding bug from console output.

## How this context reaches you (so it stays small)

- The loader injects the user-global `AGENTS.md` plus every `AGENTS.md`/`CLAUDE.md` (and `.local`
  overlay) from the project root **down to the working directory**, broad-to-specific, under a byte
  budget (**64 KB** in this deployment). A nested file joins the context once a `read`/`write`/`edit`
  touches its directory.
- Over budget, **whole broader files are dropped before the most specific one is truncated** — a fat
  root file quietly evicts project guidance. That is why this one is a router.
- **Skills are catalog-only until loaded**: the session shows each skill's name + description, and the
  body arrives only when the `skill` tool loads it by name. That is the place for task knowledge.

So: always-relevant facts go **here**, task knowledge goes into a **skill**, directory-scoped
knowledge into a **nested `AGENTS.md`** next to that subtree, and machine-specific notes into
`AGENTS.local.md` (the overlay for personal settings). When you learn something expensive, put it in
the right one of those and keep this file thin.

## Where the rest of the knowledge lives

| topic | load |
| --- | --- |
| using the stack: setup, signals, JSX/DOM contract, rules that fail silently | [docs/stack/README.md](docs/stack/README.md) |
| tests: running them, happy-dom limits, DOM test conventions | skill **`repo-testing`** (`.agents/skills/repo-testing/SKILL.md`) |
| gate internals, toolchain, versioning, publishing, troubleshooting | [README.dev.md](README.dev.md) |
| line layers, connectors, WebGPU renderer, picking | [libs/line-render/README.md](libs/line-render/README.md) |
| the editor: line-layer contract, geometry caches, device sharing | [apps/nodditor/README.md](apps/nodditor/README.md) |
| the editor's host instructions (install → blocks → lines → persistence) | [apps/nodditor/doc/getting-started.md](apps/nodditor/doc/getting-started.md) |
| the dom-observer add-on: shared observers, sharing keys, limits | [libs/dom-observer/doc/README.md](libs/dom-observer/doc/README.md) |
| styling contract (`--ne-*` custom properties, theming both layers) | [apps/nodditor/doc/styling-migration.md](apps/nodditor/doc/styling-migration.md) |
| open work, decisions taken, sequencing | [plan/line-render-followups.md](plan/line-render-followups.md) |
