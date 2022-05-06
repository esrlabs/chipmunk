export interface IRange {
    from: number;
    to: number;
}

export class Range {
    public readonly from: number;
    public readonly to: number;
    constructor(from: number, to: number) {
        if (
            from > to ||
            from < 0 ||
            to < 0 ||
            isNaN(from) ||
            isNaN(to) ||
            !isFinite(from) ||
            !isFinite(to)
        ) {
            throw new Error(`Invalid range: [${from} - ${to}]`);
        }
        this.from = from;
        this.to = to;
    }
    public get(): IRange {
        return {
            from: this.from,
            to: this.to,
        };
    }
}
