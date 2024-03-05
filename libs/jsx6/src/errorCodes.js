/*
Disclaimer: this is likely pointless
Error texts are intentionally not kept in the source, but unique numerical code is chosen for each error.
Translations of errors can be included in dev only or also in production if desired. 
*/

/** Tag is null */
export const JSX6E1_NULL_TAG = 1

/** Tag type is not supported */
export const JSX6E2_UNSUPPORTED_TAG = 2

/** Translation updater must be a function */
export const JSX6E3_TRANS_UUPD_FUNC = 3 // - UNUSED

/** not allowed to trigger dirty values during dirty update dispatch to avoid infinite updates */
export const JSX6E4_DIRTY_RECURSION = 4 // UNUSED

/** dirty runner must be a function */
export const JSX6E5_DIRTY_RUNNER_FUNC = 5 // - UNUSED

/** If you are seeing this, you forgot to call a binding as a function, or tried to call binding.toString() /. */
export const JSX6E6_MUST_CALL_BINDING = 6 // UNUSED

/** Function required */
export const JSX6E7_REQUIRE_FUNC = 7

/** parent required */
export const JSX6E8_REQUIRE_PARENT = 8 // - UNUSED

/** Event listener must be a function */
export const JSX6E9_LISTENER_MUST_BE_FUNC = 9

export const JSX6E10_CONTEXT_REQUIRED = 10 //  JSX6E10 Context to assign references required
export const JSX6E11_STATE_UPDATE_OBJECT_REQ = 11 //  JSX6E11 Update on state object can not be a primitive value
/** Item not found */
export const JSX6E12_ITEM_NOT_FOUND = 12 //  JSX6E12 Item not found
export const JSX6E13_NOT_OBSERVABLE = 13 //  JSX6E13 Object not observable
export const JSX6E14_NOT_ARRAY = 14 //  JSX6E14 provided value must be an array
export const JSX6E15_MULTIPLE_VERSIONS = 15 //  JSX6E15 mutiple versions of jsx6 library
export const JSX6E16_CUSTOM_ELEMENT_DEFINED = 16 //  JSX6E16 custom element already defined
