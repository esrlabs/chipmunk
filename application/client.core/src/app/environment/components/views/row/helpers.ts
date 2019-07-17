export function removeRowNumber(str: string): string {
    return str.replace(/^\d*\u0008/gm, '');
}
