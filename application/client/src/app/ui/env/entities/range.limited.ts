export class LimittedRange {
    public from: number;
    public to: number;
    public len: number;
    public max: number;
    private _alias: string;
    private _sticky: boolean;

    constructor(
        alias: string,
        from: number,
        to: number,
        len: number,
        max: number,
        sticky: boolean,
    ) {
        if (isNaN(from) || !isFinite(from)) {
            throw new Error(`[${alias}]: Invalid number from. Fail to change it.`);
        }
        if (isNaN(to) || !isFinite(to)) {
            throw new Error(`[${alias}]: Invalid number value for "to". Fail to change it.`);
        }
        if (isNaN(len) || !isFinite(len)) {
            throw new Error(`[${alias}]: Invalid number value for "len". Fail to change it.`);
        }
        if (isNaN(max) || !isFinite(max)) {
            throw new Error(`[${alias}]: Invalid number value for "max". Fail to change it.`);
        }
        this._alias = alias;
        this._sticky = sticky;
        this.max = max;
        this.from = from;
        this.to = to;
        this.len = len;
    }

    public $(value: number): {
        len(): LimittedRange;
        from(): LimittedRange;
        to(): LimittedRange;
        max(): LimittedRange;
    } {
        if (isNaN(value) || !isFinite(value)) {
            throw new Error(`[${this._alias}]: Invalid number. Fail to change it.`);
        }
        return {
            len: (): LimittedRange => {
                this.len = value < 0 ? 0 : value;
                this.to = this.from + this.len;
                return this._normalize();
            },
            from: (): LimittedRange => {
                this.from = value < 0 ? 0 : value;
                this.to = this.from + this.len;
                return this._normalize();
            },
            to: (): LimittedRange => {
                this.to = value < 0 ? 0 : value;
                this.from = this.to - this.len;
                return this._normalize();
            },
            max: (): LimittedRange => {
                const sticky = this._sticky ? this.to === this.max - 1 : false;
                this.max = value < 0 ? 0 : value;
                if (sticky) {
                    this.to = this.max === 0 ? 0 : this.max - 1;
                    const from = this.to - this.len;
                    this.from = from < 0 ? 0 : from;
                } else {
                    this.to = this.from + this.len;
                }
                return this._normalize();
            },
        };
    }

    public hash(): string {
        return `${this.from}.${this.to}.${this.len}.${this.max}`;
    }

    private _normalize(): LimittedRange {
        if (this.from > this.max) {
            this.from = this.max - this.len;
        }
        if (this.from < 0) {
            this.from = 0;
        }
        if (this.to >= this.max) {
            this.to = this.max - 1;
            this.from = this.to - this.len;
        }
        if (this.from < 0) {
            this.from = 0;
            this.to = Math.min(this.len, this.max - 1);
        }
        if (this.to < 0) {
            this.to = 0;
        }
        return this;
    }
}
