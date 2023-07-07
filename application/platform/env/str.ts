export function serializeHtml(str: string): string {
    return str.replace(/</gi, '&lt;').replace(/>/gi, '&gt;');
}

export function filename(filename: string): string {
    const match = filename.match(/[^/]*$/gi);
    return match === null ? '' : match[0];
}

export function basefolder(filename: string): string {
    return filename.replace(/[^/]*$/gi, '');
}

export function serializeSpaces(str: string): string {
    return str.replace(/\s/gi, '%20');
}

export function asNotEmptyString(str: unknown, msg?: string): string {
    if (typeof str !== 'string' || str.trim() === '') {
        throw new Error(msg !== undefined ? msg : `Value ${str} isn't a string`);
    }
    return str;
}

export function hash(str: string, seed = 0): number {
    let h1 = 0xdeadbeef ^ seed,
        h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
