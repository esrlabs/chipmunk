/**
 * Finds value in object but path. Returns undefined if nothing was found
 * @param {object} target any object
 * @param {string} path path to property, splited by dots. For example: "propA.propA1.propA2"
 * @returns {any}
 */
export function getValueByPath(target: any, path: string): any {
    const parts: string[] = path.split('.');
    let obj: any = target;
    let result: any;
    let valid: boolean = true;
    if (typeof obj !== 'object' || obj === null) {
        return result;
    }
    parts.forEach((part: string, index: number) => {
        if (!valid) {
            return;
        }
        if (index === parts.length - 1) {
            // Last part
            result = obj[part];
            return;
        }
        if (typeof obj[part] !== 'object' || obj[part] === null) {
            valid = false;
            return;
        }
        obj = obj[part];
    });
    return result;
}

export function merge(src: any, dest: any): any {
    Object.keys(src).forEach((prop: string) => {
        if (typeof src[prop] === 'object' && src[prop] !== null && !(src[prop] instanceof Array)) {
            if (typeof dest[prop] !== 'object' || dest[prop] === null || dest[prop] instanceof Array) {
                dest[prop] = src[prop];
            } else {
                dest[prop] = merge(src[prop], dest[prop]);
            }
        } else {
            dest[prop] = src[prop];
        }
    });
    return dest;
}

export function copy(src: any): any {
    if (src === null || typeof src === 'undefined' || typeof src === 'function') {
        return src;
    }
    if (src instanceof Array) {
        return src.map((item: any) => {
            return copy(item);
        });
    }
    if (typeof src === 'object') {
        const obj: any = {};
        Object.keys(src).forEach((prop: string) => {
            obj[prop] = copy(src[prop]);
        });
        return obj;
    }
    return src;
}

export function isSimular(src: any, pattern: any, errors: Error[] = []): Error[] {
    Object.keys(pattern).forEach((prop: string) => {
        if (typeof src[prop] === 'object' && src[prop] !== null && !(src[prop] instanceof Array)) {
            isSimular(src[prop], pattern[prop], errors);
        } else {
            if (typeof src[prop] !== typeof pattern[prop]) {
                errors.push(new Error(`Property "${prop}" has incorrect type: ${typeof src[prop]}. Expected type: ${typeof pattern[prop]}`));
            }
        }
    });
    return errors;
}

export function getJSON(str: string): any {
    try {
        return JSON.parse(str);
    } catch (e) {
        return e;
    }
}
