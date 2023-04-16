/**
 * @param {Function} callback
 */
export function observeTranslations(callback: Function): void;
export function addTranslationsAndNotify(t: any): void;
export function fireTranslationsChange(): void;
export function T(code: any): {
    (): any;
    subscribe(u: any): void;
};
export function $T($code: any): () => any;
//# sourceMappingURL=trans.d.ts.map