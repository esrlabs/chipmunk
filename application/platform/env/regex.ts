const isValidRegExpCache: { [key: string]: boolean } = {};
const safelyCreateRegExpCache: { [key: string]: RegExp | Error } = {};

export function serialize(str: string): string {
    const chars = '\\{}[]+$^/!.*|():?,=<>';
    Array.prototype.forEach.call(chars, (char: string) => {
        str = str.replace(new RegExp('\\' + char, 'gi'), '\\' + char);
    });
    return str;
}

export function isValid(strRegExp: string, parameters: string = 'gi'): boolean {
    if (typeof strRegExp !== 'string') {
        return false;
    }
    const key = `__${strRegExp}__`;
    if (isValidRegExpCache[key] !== void 0) {
        return isValidRegExpCache[key];
    }
    try {
        const regExp = new RegExp(strRegExp, parameters);
        if (regExp instanceof RegExp) {
            isValidRegExpCache[key] = true;
        }
    } catch (error) {
        isValidRegExpCache[key] = false;
    }
    return isValidRegExpCache[key];
}

export function fromStr(strRegExp: string, parameters: string = 'gi'): RegExp | Error {
    if (typeof strRegExp !== 'string') {
        return new Error(`Invalid regular expresion. String should be as source.`);
    }
    const key = `__${strRegExp}__${parameters}__`;
    if (safelyCreateRegExpCache[key] !== void 0) {
        return safelyCreateRegExpCache[key];
    }
    if (isValid(strRegExp, parameters)) {
        strRegExp = strRegExp.replace(/\\/gi, '\\');
        safelyCreateRegExpCache[key] = new RegExp(strRegExp, parameters);
    } else if (isValid(serialize(strRegExp), parameters)) {
        safelyCreateRegExpCache[key] = new RegExp(serialize(strRegExp), parameters);
    } else {
        safelyCreateRegExpCache[key] = new Error(`Invalid regular expresion`);
    }
    return safelyCreateRegExpCache[key];
}

export function createFromSerializedStr(
    strRegExp: string,
    parameters: string = 'gi',
): RegExp | Error {
    if (typeof strRegExp !== 'string') {
        return new Error(`Invalid regular expresion. String should be as source.`);
    }
    strRegExp = strRegExp.replace(/</gi, '&lt;').replace(/>/gi, '&gt;');
    return fromStr(strRegExp, parameters);
}
