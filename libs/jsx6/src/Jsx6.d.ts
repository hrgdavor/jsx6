/**
 * @class
 */
export class Jsx6 {
    constructor(attr?: {}, children?: any[]);
    isJsx6: boolean;
    el: any;
    contentArea: any;
    propKey: any;
    groupKey: any;
    tagName: string;
    cName: string;
    attr: {};
    children: any[];
    set $s(arg: any);
    get $s(): any;
    _$s: any;
    getValue(): any;
    set $v(arg: any);
    get $v(): any;
    __$v: any;
    setValue(v: any): void;
    __init(): void;
    __initialized: boolean;
    setParent(parent: any): void;
    parent: any;
    createEl(): void;
    insertAttr(attr: any): void;
    created(): void;
    initTemplate(): any;
    /**
     * @param h - jsx factory
     * @param state - state object
     * @param $ - state binding proxy
     * @param self - reference to this
     */
    tpl(h: any, state: any, $state: any, self: any): void;
    insertChildren(): void;
    init(): void;
    addEventListener(...args: any[]): void;
    getAttribute(attr: any): any;
    setAttribute(attr: any, value: any): any;
    hasAttribute(attr: any): any;
    removeAttribute(attr: any): any;
    getBoundingClientRect(): any;
    appendChild(c: any): void;
    insertBefore(c: any, before: any): void;
    get classList(): any;
    get style(): any;
    get innerHTML(): any;
    get textContent(): any;
}
export namespace Jsx6 {
    const isComponentClass: boolean;
}
//# sourceMappingURL=Jsx6.d.ts.map