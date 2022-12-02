export function getValidNum(val: unknown): number {
    if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
        throw new Error(`Invalid number: ${val}`);
    }
    return val;
}
