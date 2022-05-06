export function removeRowNumber(str: string): string {
    return str.replace(/^\d*\u0008/gm, '');
}

export function cleanupOutput(str: string): string {
    return removeRowNumber(str)
        .replace(/\u0004/gi, '')
        .replace(/\u0005/gi, '');
}
