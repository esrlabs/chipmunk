export interface IRange {
    from: number;
    to: number;
}

export class Range {
    public readonly from: number;
    public readonly to: number;
    public readonly spec: {
        // true - will use i >= from; false - i > from
        left: boolean;
        // true - will use i <= to; false - i > to
        right: boolean;
        // true - range in this case will be valid for i < from
        before: boolean;
        // true - range in this case will be valid for i > to
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

    public len(): number {
        return this.to - this.from;
    }

    public get(): IRange {
        return {
            from: this.from,
            to: this.to,
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
        if (this.spec.before && this.spec.left && int <= this.from) {
            return true;
        }
        if (this.spec.before && !this.spec.left && int < this.from) {
            return true;
        }
        if (this.spec.after && this.spec.right && int >= this.to) {
            return true;
        }
        if (this.spec.after && !this.spec.right && int > this.to) {
            return true;
        }
        if (this.spec.after || this.spec.before) {
            return false;
        }
        if (this.spec.left && this.spec.right && int >= this.from && int <= this.to) {
            return true;
        }
        if (!this.spec.left && this.spec.right && int > this.from && int <= this.to) {
            return true;
        }
        if (this.spec.left && !this.spec.right && int >= this.from && int < this.to) {
            return true;
        }
        if (!this.spec.left && !this.spec.right && int > this.from && int < this.to) {
            return true;
        }
        return false;
    }

    public equal(range: Range): boolean {
        if (this.from !== range.from || this.to !== range.to) {
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
