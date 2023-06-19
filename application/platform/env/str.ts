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
