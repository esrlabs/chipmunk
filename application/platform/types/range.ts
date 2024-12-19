import * as num from '../env/num';

export interface IRange {
    start: number;
    end: number;
}

export function fromTuple(
    range: [number, number] | { start: number; end: number } | unknown,
): IRange | Error {
    if (range instanceof Array && range.length === 2) {
        if (!num.isValidU32(range[0])) {
            return new Error(
                `Begining of range isn't valid: ${range[0]}; ${JSON.stringify(range)}`,
            );
        }
        if (!num.isValidU32(range[1])) {
            return new Error(`End of range isn't valid: ${range[1]}; ${JSON.stringify(range)}`);
        }
        return { start: range[0], end: range[1] };
    } else if (typeof range === 'object' && range !== undefined && range !== null) {
        const asObj = range as { start: number; end: number };
        if (!num.isValidU32(asObj.start)) {
            return new Error(
                `Begining of range isn't valid: ${asObj.start}; ${JSON.stringify(range)}`,
            );
        }
        if (!num.isValidU32(asObj.end)) {
            return new Error(`End of range isn't valid: ${asObj.end}; ${JSON.stringify(range)}`);
        }
        return { start: asObj.start, end: asObj.end };
    } else {
        return new Error(`Expecting tuple: [number, number]: ${JSON.stringify(range)}`);
    }
}

export class Range {
    public readonly start: number;
    public readonly end: number;
    public readonly spec: {
        // true - will use i >= start; false - i > start
        left: boolean;
        // true - will use i <= end; false - i > end
        right: boolean;
        // true - range in this case will be valid for i < start
        before: boolean;
        // true - range in this case will be valid for i > end
        after: boolean;
    } = {
        left: true,
        right: true,
        before: false,
        after: false,
    };

    public static get<T>(range: Range, src: T[], index: (entry: T) => number): T[] {
        return src.filter((r) => range.in(index(r)));
    }

    constructor(start: number, end: number) {
        if (
            start > end ||
            start < 0 ||
            end < 0 ||
            isNaN(start) ||
            isNaN(end) ||
            !isFinite(start) ||
            !isFinite(end)
        ) {
            throw new Error(`Invalid range: [${start} - ${end}]`);
        }
        this.start = start;
        this.end = end;
    }

    public asObj(): IRange {
        return { start: this.start, end: this.end };
    }

    public len(): number {
        return this.end - this.start;
    }

    public get(): IRange {
        return {
            start: this.start,
            end: this.end,
        };
    }

    public left(value: boolean): Range {
        this.spec.left = value;
        return this;
    }

    public right(value: boolean): Range {
        this.spec.right = value;
        return this;
    }

    public after(value: boolean): Range {
        this.spec.after = value;
        return this;
    }

    public before(value: boolean): Range {
        this.spec.before = value;
        return this;
    }

    public in(int: number): boolean {
        if (this.spec.before && this.spec.left && int <= this.start) {
            return true;
        }
        if (this.spec.before && !this.spec.left && int < this.start) {
            return true;
        }
        if (this.spec.after && this.spec.right && int >= this.end) {
            return true;
        }
        if (this.spec.after && !this.spec.right && int > this.end) {
            return true;
        }
        if (this.spec.after || this.spec.before) {
            return false;
        }
        if (this.spec.left && this.spec.right && int >= this.start && int <= this.end) {
            return true;
        }
        if (!this.spec.left && this.spec.right && int > this.start && int <= this.end) {
            return true;
        }
        if (this.spec.left && !this.spec.right && int >= this.start && int < this.end) {
            return true;
        }
        if (!this.spec.left && !this.spec.right && int > this.start && int < this.end) {
            return true;
        }
        return false;
    }

    public equal(range: Range): boolean {
        if (this.start !== range.start || this.end !== range.end) {
            return false;
        }
        if (
            this.spec.left !== range.spec.left ||
            this.spec.right !== range.spec.right ||
            this.spec.after !== range.spec.after ||
            this.spec.before !== range.spec.before
        ) {
            return false;
        }
        return true;
    }
}

export function fromIndexes(indexes: number[]): IRange[] {
    if (indexes.length === 0) {
        return [];
    }
    const ranges: IRange[] = [];
    indexes.sort((a, b) => (a >= b ? 1 : -1));
    let start: number = -1;
    let end = -1;
    indexes.forEach((i) => {
        if (i < 0 || isNaN(i) || !isFinite(i)) {
            throw new Error(`Invalid index: ${i}`);
        }
        if (end === -1) {
            end = i;
        }
        if (start === -1) {
            start = i;
            return;
        }
        if (i === end + 1) {
            end = i;
            return;
        }
        ranges.push({ start, end });
        start = i;
        end = i;
    });
    start !== -1 && ranges.push({ start, end: indexes[indexes.length - 1] });
    return ranges;
}
