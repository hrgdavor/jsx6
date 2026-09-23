/**
 * Attribute updates.
 *
 * The implementation lives in `@jsx6/signal-dom` (plan/improvement-plan.md P3-1); this module only
 * re-exports it. That copy accepts plain DOM nodes *and* component/object wrappers exposing the node
 * on `.el`, which is the contract jsx6 callers rely on.
 *
 * Follow-up for the next major: drop this file and import `@jsx6/signal-dom` directly.
 */
export { setAttribute } from '@jsx6/signal-dom'
