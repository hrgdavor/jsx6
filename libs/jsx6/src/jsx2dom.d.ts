/** Short but pretty usable support function for JSX.
 *
 * @param {String|Function} tag
 * @param {Object} attr
 * @param  {...any} children
 * @returns {Element}
 */
export function h(tag: string | Function, attr: any, ...children: any[]): Element;
export function nodeFromObservable(obj: any): Text[];
/** Enable creating html elements with option to assign parts to properties on the provided scope object.
 * Adding attribute `p` to an element `<div p="searchBox"` will cause generator to
 * assign the created element to `scope.searchBox`
 *
 * Callback must expose the first parameter exactly like this: `domWithScope(scope,h=><b>Bla</b>)`
 * so that generated JS form JSX will use that scoped function
 *
 * @param {Object} scope object that will receive references to parts of the content
 * @param {Function} f callback inside which te html needs to be created
 * @returns
 */
export function domWithScope(scope: any, f: Function): any;
export function domToProps(f: any): {};
export function insertAttr(attr: any, out: any, self: any, component: any): void;
export function forInsert(newChild: any): any;
export function insert(parent: any, newChild: any, before: any, _self: any): any;
export function changeFactories(func: any): void;
export function getScope(): any;
export function hSvg(tag: any, attr: any, ...children: any[]): any;
export function svg(callback: Function): any;
export function textValue(v: any): any;
export function makeUpdater(parent: any, before: any, attr: any, func: any): void;
export function makeNodeUpdater(node: any, func: any): {
    (): void;
    node: any;
};
export function makeAttrUpdater(node: any, attr: any, func: any): {
    (): void;
    node: any;
    attr: any;
    func: any;
};
export function addToBody(n: any): any;
export function addToHead(n: any): any;
//# sourceMappingURL=jsx2dom.d.ts.map