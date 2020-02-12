const CRanks = [
    { rank: 1000000000000, label: 'B' },
    { rank: 1000000000, label: 'T' },
    { rank: 1000000, label: 'M' },
    { rank: 1000, label: 'K' },
];
export function rankedNumberAsString(num: number): string {
    if (typeof num !== 'number') {
        return '';
    }
    let target;
    CRanks.forEach((rank) => {
        if (num > rank.rank && target === undefined) {
            target = rank;
        }
    });
    if (target === undefined) {
        return num.toString();
    }
    return (num / target.rank).toFixed(2) + target.label;
}
