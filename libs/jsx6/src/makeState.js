/**
 * Batching for signal-driven DOM updates.
 *
 * The implementation lives in `@jsx6/signal-dom` (the "signals in DOM" package). This module only
 * re-exports it, so the two copies can no longer drift — they had already diverged in ways that
 * mattered: this copy bound its animation-frame function to the window while signal-dom's did not,
 * and each copy kept its own batch queue
 * (plan/improvement-plan.md P3-1).
 *
 * The named re-exports are deliberate: a second `export *` of `setAttribute` (which signal-dom also
 * exports, and which `./setAttribute.js` re-exports for jsx6) would make the name ambiguous and
 * silently drop it from the package entry point.
 *
 * Follow-up for the next major: drop this file and import `@jsx6/signal-dom` directly.
 */
export { callAnim, runDirty, runInBatch, setAnimFunction } from '@jsx6/signal-dom'
