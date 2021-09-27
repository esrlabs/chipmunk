export function isObjSame(a: any, b: any): boolean {
    if (typeof a !== 'object' || typeof b !== 'object') {
        return false;
    }
    if (a === null || b === null) {
        return false;
    }
    if (Object.keys(a).length !== Object.keys(b).length) {
        return false;
    }
    let result: boolean = true;
    [
        [a, b],
        [b, a],
    ].forEach((targets: any[]) => {
        const _a = targets[0];
        const _b = targets[1];
        Object.keys(_a).forEach((prop: string) => {
            if (!result) {
                return;
            }
            if (typeof _a[prop] !== typeof _b[prop]) {
                result = false;
            }
            if (
                ['string', 'number', 'boolean'].indexOf(typeof _a[prop]) !== -1 &&
                _a[prop] !== _b[prop]
            ) {
                result = false;
            }
        });
    });
    return result;
}

export function getPropByPath<T>(obj: any, path: string): T | Error {
    const parts: string[] = path.split('.');
    let value: any = obj;
    let error: Error | undefined;
    const pass: string[] = [];
    parts.forEach((step: string, index: number) => {
        if (error !== undefined) {
            return;
        }
        if (index === parts.length - 1) {
            value = value[step];
        } else {
            if (typeof value !== 'object' || value === null) {
                error = new Error(`Value on steps "${pass.join('.')}" isn't an object.`);
                return;
            }
            value = value[step];
            pass.push(step);
        }
    });
    return error === undefined ? (value as T) : error;
}
