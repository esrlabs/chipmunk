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
