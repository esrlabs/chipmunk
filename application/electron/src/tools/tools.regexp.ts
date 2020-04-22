const isValidRegExpCache: { [key: string]: boolean } = {};

export function PCREToECMARegExp(source: string) {
    const groups: RegExpMatchArray | null = source.match(/\?P\<[\w\d]+\>/gi);
    if (groups === null || groups.length === 0) {
        return source;
    }
    Array.prototype.forEach.call(groups, (group: string) => {
        source = source.replace(group, group.replace('?P<', '?<'));
    });
    return source;
}

export function isRegStrValid(strRegExp: string, parameters: string = 'gi'): boolean {
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
