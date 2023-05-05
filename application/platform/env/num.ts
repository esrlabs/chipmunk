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

const U32 = [0, 4294967295];

export function isValidU32(value: string | number): boolean {
    const u32: number = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(u32) || !isFinite(u32)) {
        return false;
    }
    if (u32 < U32[0] || u32 > U32[1]) {
        return false;
    }
    return true;
}
