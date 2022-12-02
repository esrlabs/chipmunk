export class Breadcrumbs {
    public static MIN_OFFSET = 2;
    public static OFFSET_STEP = 10;
    public static MIN_DISTANCE = 4;

    protected separators: Map<number, number> = new Map();
    public extended: number[] = [];

    public collect(matches: number[], stream: number): number[] {
        this.separators.clear();
        this.extended = [];
        if (matches.length === 0) {
            return this.extended;
        }
        const complete = (from: number, to: number) => {
            for (let n = from + (from === 0 ? 0 : 1); n <= to - 1; n += 1) {
                this.extended.push(n);
            }
        };
        const fill = (from: number, to: number) => {
            const middle = from + Math.floor((to - from) / 2);
            for (let n = from + (from === 0 ? 0 : 1); n <= from + Breadcrumbs.MIN_OFFSET; n += 1) {
                this.extended.push(n);
            }
            this.extended.push(middle);
            for (let n = to - 1; n >= to - Breadcrumbs.MIN_OFFSET; n -= 1) {
                this.extended.push(n);
            }
            this.separators.set(middle, middle);
        };
        if (matches[0] <= Breadcrumbs.MIN_DISTANCE + 2) {
            complete(0, matches[0]);
        } else {
            fill(0, matches[0]);
        }
        matches.sort((to, from) => {
            const len = to - from;
            if (len <= 1) {
                return to >= from ? 1 : -1;
            }
            if (len <= Breadcrumbs.MIN_DISTANCE + 2) {
                complete(from, to);
                return to >= from ? 1 : -1;
            }
            fill(from, to);
            return to >= from ? 1 : -1;
        });
        const last = matches[matches.length - 1];
        const rest = stream - last;
        if (rest <= Breadcrumbs.MIN_DISTANCE + 2) {
            complete(last, stream);
        } else {
            fill(last, stream);
        }
        this.extended.sort((a, b) => {
            return a >= b ? 1 : -1;
        });
        return this.extended;
    }

    public isSeparator(position: number): boolean {
        return this.separators.has(position);
    }

    public extending(position: number, before: boolean): void {
        let index = this.extended.indexOf(position);
        if (index === -1) {
            return;
        }
        if (before) {
            if (index === 0) {
                return;
            }
            const prev = this.extended[index - 1];
            const min = Math.min(position - 1, prev + Breadcrumbs.OFFSET_STEP);
            for (let n = prev + 1; n <= min; n += 1) {
                this.extended.push(n);
            }
        } else {
            if (index === this.extended.length - 1) {
                return;
            }
            const next = this.extended[index + 1];
            const max = Math.max(position + 1, next - Breadcrumbs.OFFSET_STEP);
            for (let n = next - 1; n >= max; n -= 1) {
                this.extended.push(n);
            }
        }
        this.extended.sort((a, b) => {
            return a >= b ? 1 : -1;
        });
        index = this.extended.indexOf(position);
        if (
            position === this.extended[index - 1] + 1 &&
            position === this.extended[index + 1] - 1
        ) {
            this.separators.delete(position);
        }
    }

    public left(position: number): {
        before(): number;
        after(): number;
    } {
        const index = this.extended.indexOf(position);
        return {
            before: (): number => {
                if (index === 0 || index === -1) {
                    return 0;
                }
                return position - this.extended[index - 1] - 1;
            },
            after: (): number => {
                if (index === -1 || index === this.extended.length - 1) {
                    return 0;
                }
                return this.extended[index + 1] - position - 1;
            },
        };
    }

    public drop() {
        this.separators.clear();
        this.extended = [];
    }
}
