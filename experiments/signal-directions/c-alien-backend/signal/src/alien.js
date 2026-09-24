/**
 * The one place that knows where the alien-signals dependency comes from.
 *
 * In this experiment direction the harness compares against a *vendored* copy of alien-signals
 * (`experiments/signal-directions/vendor/alien-signals`), and the harness tasks import that same file —
 * so this module must point at it too. Importing the npm `alien-signals` here would give the process two
 * independent alien instances, and a signal created in one is invisible to a computed in the other (which
 * is exactly how the interop tasks failed).
 */

export * from '../../../vendor/alien-signals/index.mjs'