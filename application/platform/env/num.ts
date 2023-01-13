export function diffUInts(nums: unknown[], defaults: number): number {
    let valid = true;
    nums.forEach((n: unknown) => {
        if (!valid) {
            return;
        }
        if (typeof n !== 'number' || isNaN(n) || !isFinite(n) || n < 0) {
            valid = false;
        }
    });
    if (!valid) {
        return defaults;
    }
    const initial = nums.shift() as number;
    return (nums as number[]).reduce((r, c) => r - c, initial);
}
