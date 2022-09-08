/* Error codes are intentionally not kept in the source, but unique numerical code is chosen for each
error is thrown using translation, so translations of errors can be included if desired in dev only
or also in production if so desired. The choice is yours :)
*/
export const ERR_NULL_TAG = 1 //           JSX6E1 - Tag is null
export const ERR_UNSUPPORTED_TAG = 2 //    JSX6E2 - Tag type is not supported
export const ERR_TRANS_UUPD_FUNC = 3 //    JSX6E3 - Translation updater must be a function
export const ERR_DIRTY_RECURSION = 4 //    JSX6E4 - not allowed to trigger dirty values during dirty update dispatch to avoid infinite updates
export const ERR_DIRTY_RUNNER_FUNC = 5 //  JSX6E5 - dirty runner must be a function
export const ERR_MUST_CALL_BINDING = 6 //  JSX6E6 - If you are seeing this, you forgot to call a binding as a function, or tried to call binding.toString() /.
export const ERR_REQUIRE_FUNC = 7 //       JSX6E7 - Function required
export const ERR_REQUIRE_PARENT = 8 //     JSX6E8 - parent required
export const ERR_LISTENER_MUST_BE_FUNC = 9 //    JSX6E9 - Event listener must be a function
export const ERR_CONTEXT_REQUIRED = 10 //  JSX6E10 Context to assign references required
