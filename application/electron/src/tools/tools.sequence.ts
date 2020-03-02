
let seq: number = 1;

export default function sequence(): number {
    return seq++;
}

const custom: { [key: string]: number } = {};

export function getSequence(key: string, defaults: number = 1): number {
    if (custom[key] === undefined) {
        custom[key] = defaults;
    }
    return custom[key]++;
}
