/** Set runner other than the default requestAnimationFrame
 *
 * @param {Function} animFunc
 */
export function setAnimFunction(animFunc: Function): void;
/** Schedule to run batch on the next animation frame (default runner is requestAnimationFrame)
 *
 * @param {Function} callback
 */
export function callAnim(callback: Function): void;
/** Add callback to the next batch, or run now if `isRunning==true` (the batch is running alreaday)
 *
 * @param {Function} callback to add
 * @returns {void}
 */
export function runInBatch(callback: Function): void;
/** Run all of the callback that need to execute the change notification (have dirty values)
 *
 */
export function runDirty(): void;
export function doSubscribeValue(updaters: any, updater: any, func: any): void;
export function doSubscribe(updaters: any, updater: any): void;
export function makeState(rawState: any, returnAll: any): any[] | ((f: any, ...args: any[]) => any);
export function extendValue(obj: any, value: any): void;
export const extendValueSymbol: unique symbol;
//# sourceMappingURL=makeState.d.ts.map