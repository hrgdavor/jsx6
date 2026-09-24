/**
 * Control direction: the **frozen pre-graduation core** (`@jsx6/signal@1.8.18`).
 *
 * Until B was graduated, this directory simply re-exported the workspace `@jsx6/signal`. Now that the
 * shipped package *is* B, that link would have silently turned the control into a second copy of B —
 * every "vs baseline" column in the reports would have become meaningless.
 *
 * So the 1.8.18 sources are frozen here (`./signal/`, copied verbatim before the graduation edit) and
 * this module re-exports them. Nothing in `libs/` is involved, and the frozen copy is never edited: it
 * is the historical control the reports compare against.
 *
 * `current/` re-exports the *shipped* core, so the pair `current` vs `baseline` answers "what did
 * graduation change?", while `b-native-computed/` is the reference implementation of the same code.
 */

export * from './signal/index.js'

export const meta = {
  id: 'baseline',
  name: 'baseline — frozen @jsx6/signal 1.8.18 (pre-graduation control)',
  backend: 'pre-graduation eager core (snapshot)',
  capabilities: ['core'],
  deps: [],
  loc: 0,
  notes:
    'frozen snapshot of libs/signal as it was at 1.8.18, taken before B was graduated in place; the ' +
    'control every report compares against. Not edited afterwards.',
}