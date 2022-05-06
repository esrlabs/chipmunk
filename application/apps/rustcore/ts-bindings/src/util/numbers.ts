export function getValidNum(val: unknown, defaults: number): number {
    if (typeof val !== 'number') {
        return defaults;
    }
    if (isNaN(val) || !isFinite(val)) {
        throw new Error(`Invalid number: ${val}`);
    }
    return val;
}
