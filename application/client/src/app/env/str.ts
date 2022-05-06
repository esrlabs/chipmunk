export function bytesToStr(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} b`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)}Kb`;
    }
    if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / 1024 / 1024).toFixed(2)}Mb`;
    }
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}Gb`;
}

export function timestampToUTC(ts: number): string {
    return new Date(ts).toUTCString();
}
