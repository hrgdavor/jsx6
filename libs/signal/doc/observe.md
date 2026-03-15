# Signal Observation Implementation Details

The `_observe` function is the polymorphic backbone of the `@jsx6/signal` library's observation system. It handles internal signals, external Promises, standard Observables, and static values under a unified API.

## Observation Types

### 1. Internal Signals
Detected via `Symbol.for('signalSubscribe')`. 
- **Efficiency**: Signals do not inherently pass their value to listeners to avoid unnecessary calculations if the listener only needs to know *that* something changed.
- **Callback Wrapping**: If `passValue` is true, `_observe` wraps the listener to manually pull the current value: `() => callback(obj())`. 

### 2. Promises
Detected via the presence of a `.then` method.
- **Value Handling**: Promises always provide a value upon resolution.
- **DX Consistency**: If `passValue` is false (e.g., via `subscribe`), the callback is wrapped as `() => callback()` to prevent the Promise's result from being passed, ensuring consistent "notification-only" behavior.

### 3. External Observables
Detected via the presence of a `.subscribe` method. 
- Similar to Promises, many Observables (like RxJS) automatically pass values. `_observe` wraps the callback if `passValue` is false to maintain notification consistency.

### 4. Static Values
If an object is not a Signal, Promise, or Observable, it is treated as a static value.
- **Behavior**: It will never trigger a change notification.
- **Initial Trigger**: If `trigger` is true, the callback is executed immediately with the static value (if `passValue` is true).

## Flags and Nuances

### `passValue` (Internal Consistency)
This flag determines whether the listener expects the current data or just a notification.
- **Reliability**: We guarantee that if `passValue` is false, the callback receives **zero arguments**. This is crucial for internal performance optimizations and predictable developer experience.

### `trigger` (Immediate Execution)
Controls whether the callback should run immediately with the current state.
- **Signals**: Pulls the value immediately.
- **Promises**: Since they are inherently asynchronous, the "immediate" trigger for a Promise is not truly synchronous in the same way as a Signal, but follows the `.then` resolution path.

## Public APIs

- **`observe(obj, callback, trigger)`**: The standard way to get values. Uses `passValue: true`.
- **`observeNow(obj, callback)`**: Shorthand for `observe(obj, callback, true)`.
- **`subscribe(obj, callback, trigger)`**: The optimized way to listen for changes without the overhead of value pulling. Uses `passValue: false`.
