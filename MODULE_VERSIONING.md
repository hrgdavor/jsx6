# Module Versioning Strategy

This document describes the versioning strategy for the packages in this monorepo, migrated from Rush version policies.

## Lockstep Modules

The following modules share the same version number and are always released together. 
Current Version: **1.8.15**

- `@jsx6/jsx6` (libs/jsx6)
- `@jsx6/jsx-runtime` (libs/jsx-runtime)
- `@jsx6/jsx-dev-runtime` (libs/jsx-dev-runtime)
- `@jsx6/signal` (libs/signal)
- `@jsx6/signal-clock` (libs/signal-clock)
- `@jsx6/signal-dom` (libs/signal-dom)
- `@jsx6/w` (libs/w)
- `@jsx6/repl` (apps/repl)

## Standalone Modules

The following modules are versioned independently.

- `@jsx6/build` (tools/build)
- `@jsx6/editor-monaco` (libs/editor-monaco)
- `@jsx6/dom-observer` (libs/dom-observer)
- `@jsx6/popover` (libs/popover)
- `@jsx6/scloop` (libs/scloop)
- `@jsx6/url-util` (libs/url-util)
- `@jsx6/nodditor` (apps/nodditor)
