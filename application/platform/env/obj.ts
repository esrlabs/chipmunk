export type AnyObj = { [key: string]: unknown };

const U32 = [0, 4294967295];

export function isValidU32(value: string): boolean {
    const u32: number = parseInt(value, 10);
    if (isNaN(u32) || !isFinite(u32)) {
        return false;
    }
    if (u32 < U32[0] || u32 > U32[1]) {
        return false;
    }
    return true;
}

export function sterilize<T>(smth: T, ignore: string[] = []): T {
    if (isPrimitiveOrNull(smth)) {
        return smth;
    }
    if (['function', 'symbol'].includes(typeof smth)) {
        return smth;
    }
    if (smth instanceof Array) {
        return smth.map((el) => sterilize(el, ignore)) as T;
    } else if (typeof smth === 'object') {
        const clone: any = {};
        Object.keys(smth as any).forEach((key: string) => {
            if (ignore.includes(key)) {
                return;
            }
            clone[key] = sterilize((smth as any)[key], ignore);
        });
        return clone;
    } else {
        return smth;
    }
}

export function isPrimitiveOrNull(smth: any): boolean {
    if (['string', 'number', 'boolean', 'undefined'].includes(typeof smth) || smth === null) {
        return true;
    }
    return false;
}

export function isArrayOrObj(smth: any): boolean {
    if (isPrimitiveOrNull(smth)) {
        return false;
    }
    if (smth instanceof Array || typeof smth === 'object') {
        return true;
    } else {
        return false;
    }
}

export function is(smth: any): boolean {
    if (typeof smth !== 'object' || smth === null) {
        return false;
    } else if (smth instanceof Array) {
        return false;
    } else if (
        typeof smth.constructor === 'function' &&
        typeof smth.constructor.name === 'string' &&
        smth.constructor.name.toLowerCase() !== 'object'
    ) {
        return false;
    }
    return true;
}

export function clone<T>(obj: T, deep: number = 10): T {
    deep -= 1;
    if (deep < 0) {
        throw new Error(`Fail to clone obj. Deep limit has been reached.`);
    }
    if (obj instanceof Array) {
        return obj.map((item: any) => clone(item, deep)) as unknown as T;
    } else if (!is(obj)) {
        return obj as unknown as T;
    }
    const _obj: any = Object.assign({}, obj);
    Object.keys(_obj).forEach((prop: string) => {
        if (_obj[prop] instanceof Array) {
            _obj[prop] = _obj[prop].map((item: any) => clone(item, deep));
        } else if (is(obj)) {
            _obj[prop] = clone(_obj[prop], deep);
        }
    });
    return _obj;
}

export function asAnyObj<T>(smth: T): AnyObj {
    return smth as unknown as AnyObj;
}

export function setProp<T>(dest: T, prop: string, value: unknown) {
    if ((dest ?? true) === true || typeof dest !== 'object') {
        throw new Error(`Expecting an object`);
    }
    (dest as any)[prop] = value;
}

export function getProp<T>(dest: T, prop: string): unknown {
    if ((dest ?? true) === true || typeof dest !== 'object') {
        throw new Error(`Expecting an object`);
    }
    return (dest as any)[prop];
}

export function getTypedProp<T, O>(dest: T, prop: string): O {
    if ((dest ?? true) === true || typeof dest !== 'object') {
        throw new Error(`Expecting an object`);
    }
    if ((dest as any)[prop] === undefined) {
        throw new Error(`Target property "${prop}" is undefined.`);
    }
    return (dest as any)[prop] as O;
}

export function getPropByPath<T, O>(dest: T, path: string): O | undefined {
    if ((dest ?? true) === true) {
        return undefined;
    }
    const parts: string[] = path.split('.');
    const current = asAnyObj(dest)[parts[0]];
    parts.splice(0, 1);
    if (parts.length === 0) {
        return current as O;
    } else {
        return getPropByPath(current, parts.join('.'));
    }
}

export function createPath<T>(dest: T, path: string): void {
    if ((dest ?? true) === true) {
        return undefined;
    }
    const parts: string[] = path.split('.');
    if (asAnyObj(dest)[parts[0]] === undefined) {
        asAnyObj(dest)[parts[0]] = {};
    }
    const current = asAnyObj(dest)[parts[0]];
    parts.splice(0, 1);
    if (parts.length > 0) {
        createPath(current, parts.join('.'));
    }
}

export function getWithDefaults<T>(obj: any, prop: string, defaults: T): T {
    if (obj === undefined || obj === null) {
        throw new Error(`Target cannot be null or undefined`);
    }
    if (obj[prop] === undefined || typeof obj[prop] !== typeof defaults) {
        obj[prop] = defaults;
    }
    return obj[prop];
}
export function isObject(src: any) {
    if ((src ?? true) === true || typeof src !== 'object') {
        throw new Error(`Expecting an object`);
    }
}

export function getObject(src: any): Record<string, unknown> {
    if ((src ?? true) === true || typeof src !== 'object') {
        throw new Error(`Expecting an object`);
    }
    return src;
}
export function getAsString(src: any, key: string): string {
    if (typeof src[key] !== 'string') {
        throw new Error(`Parameter "${key}" should be a none-empty string`);
    }
    return src[key];
}
export function getAsStringOrNull(src: any, key: string): string {
    if (typeof src[key] !== 'string' && src[key] !== null) {
        throw new Error(`Parameter "${key}" should be a string or null`);
    }
    return src[key];
}
export function getAsNotEmptyString(src: any, key: string): string {
    if (typeof src[key] !== 'string' || src[key].trim() === '') {
        throw new Error(`Parameter "${key}" should be a none-empty string`);
    }
    return src[key];
}
export function getAsArrayOfNotEmptyString(src: any, key: string): string[] {
    if (!(src[key] instanceof Array)) {
        throw new Error(`Parameter "${key}" should be valid array`);
    }
    for (const elem in src[key]) {
        if (typeof elem !== 'string' || elem.trim() === '') {
            throw new Error(`Parameter "${key}" should be a array of none-empty string`);
        }
    }
    return src[key];
}
export function getAsNotEmptyStringOrAsUndefined(src: any, key: string): string {
    if (typeof src[key] === 'string' && src[key].trim() === '') {
        throw new Error(`Parameter "${key}" should be a none-empty string`);
    }
    return src[key];
}

export function getAsBool(src: any, key: string, defaults?: boolean): boolean {
    if (typeof src[key] !== 'boolean') {
        if (defaults !== undefined) {
            return defaults;
        }
        throw new Error(`Parameter "${key}" should be a boolean`);
    }
    return src[key];
}

export function getAsMap(src: any, key: string): any {
    if (!(src[key] instanceof Map)) {
        throw new Error(`Parameter "${key}" should be a Map`);
    }
    return src[key];
}

export function getAsMapOrNull(src: any, key: string): any {
    if (!(src[key] instanceof Map)) {
        if (src[key] === null) {
            return null;
        }
        throw new Error(`Parameter "${key}" should be a Map or NULL`);
    }
    return src[key];
}

export function getAsObj(src: any, key: string, defaults?: unknown): any {
    if (typeof src[key] !== 'object') {
        if (defaults !== undefined) {
            return defaults;
        }
        throw new Error(`Parameter "${key}" should be a object`);
    }
    return src[key];
}

export function getAsObjWithPrimitives(src: any, key: string): any {
    if (typeof src[key] !== 'object') {
        throw new Error(`Parameter "${key}" should be a object`);
    }
    Object.keys(src[key]).forEach((k: string) => {
        const type = typeof src[key][k];
        if (type === 'function' || type === 'object' || type === 'symbol') {
            throw new Error(
                `Key "${k}" (of property "${key}") should be a primitive type; actual type: ${type}`,
            );
        }
    });
    return src[key];
}

export function getAsObjOrUndefined(src: any, key: string, defaults?: unknown): any {
    if (typeof src[key] !== 'object' || isUndefinedOrNull(src, key)) {
        if (defaults !== undefined) {
            return defaults;
        } else {
            return undefined;
        }
    }
    return src[key];
}

export function getAsValidNumber(
    src: any,
    key: string,
    conditions?: { min?: number; max?: number; defaults?: number },
): number {
    if (typeof src[key] !== 'number' || isNaN(src[key]) || !isFinite(src[key])) {
        if (conditions !== undefined) {
            if (conditions.defaults !== undefined) {
                return conditions.defaults;
            }
        }
        throw new Error(`Parameter "${key}" should be valid number`);
    }
    if (conditions !== undefined) {
        if (conditions.min !== undefined && src[key] < conditions.min) {
            throw new Error(`Parameter "${key}" should be > ${conditions.min}`);
        }
        if (conditions.max !== undefined && src[key] > conditions.max) {
            throw new Error(`Parameter "${key}" should be > ${conditions.max}`);
        }
    }
    return src[key];
}

export function getAsValidNumberOrUndefined(
    src: any,
    key: string,
    conditions?: { min?: number; max?: number; defaults?: number },
): number | undefined {
    return isUndefinedOrNull(src, key) ? undefined : getAsValidNumber(src, key, conditions);
}

export function getAsArray<T>(src: any, key: string): Array<T> {
    if (!(src[key] instanceof Array)) {
        throw new Error(`Parameter "${key}" should be valid array`);
    }
    return src[key];
}

export function isUndefinedOrNull(src: any, key: string): boolean {
    return src[key] === undefined || src[key] === null;
}

export function getAsArrayOrUndefined<T>(src: any, key: string): Array<T> | undefined {
    if (!(src[key] instanceof Array)) {
        return undefined;
    }
    return src[key];
}

export function getAsStringsArrayOrUndefined<T>(src: any, key: string): Array<T> | undefined {
    const target = src[key];
    if (!(target instanceof Array)) {
        return undefined;
    }
    target.forEach((el: string) => {
        if (typeof el !== 'string') {
            throw new Error(`Expected type: string[]; found not string elements`);
        }
    });
    return target;
}

export function getAsNotEmptyStringsArrayOrUndefined<T>(
    src: any,
    key: string,
): Array<T> | undefined {
    const target = src[key];
    if (!(target instanceof Array)) {
        return undefined;
    }
    target.forEach((el: string) => {
        if (typeof el !== 'string') {
            throw new Error(`Expected type: string[]; found not string elements`);
        }
        if (el.trim() === '') {
            throw new Error(`Expected type: string[] without empty strings; found empty strings`);
        }
    });
    return target;
}

export function from<T>(src: any, props: string[]): T {
    if (typeof src !== 'object') {
        throw new Error(`Expecting an object`);
    }
    const smth: Record<string, unknown> = {};
    props.forEach((prop: string) => {
        if (src[prop] === undefined) {
            throw new Error(`Property "${prop}" doesn't exist on source object`);
        }
        smth[prop] = src[prop];
    });
    return smth as T;
}

export function getSafeObj(dest: unknown): { [key: string]: string } | Error {
    if (
        typeof dest !== 'object' ||
        dest === undefined ||
        dest === null ||
        dest instanceof Array ||
        typeof dest === 'function'
    ) {
        return new Error(`Dest isn't any object; type = ${typeof dest}; value = ${dest}`);
    }
    const result: { [key: string]: string } = {};
    Object.keys(dest).forEach((key: any) => {
        if (typeof key !== 'string') {
            return;
        }
        if (!Object.hasOwn(dest, key)) {
            return;
        }
        const value = (dest as any)[key];
        result[key] = typeof value !== 'string' ? `${value}` : value;
    });
    return result;
}

export function mapToObj<V>(map: Map<string | number | symbol, V>): {
    [key: string | number | symbol]: V;
} {
    const output: {
        [key: string | number | symbol]: V;
    } = {};
    map.forEach((v, k) => {
        output[k] = v;
    });
    return output;
}

export function objToMap<V>(obj: {
    [key: string | number | symbol]: V;
}): Map<string | number | symbol, V> {
    const output: Map<string | number | symbol, V> = new Map();
    Object.keys(obj).forEach((k) => output.set(k, obj[k]));
    return output;
}

export function objToStringMap(obj: {
    [key: string | number | symbol]: string;
}): Map<string | number | symbol, string> {
    const output: Map<string | number | symbol, string> = new Map();
    Object.keys(obj).forEach((k) => {
        output.set(k, typeof obj[k] !== 'string' ? `${obj[k]}` : obj[k]);
    });
    return output;
}
