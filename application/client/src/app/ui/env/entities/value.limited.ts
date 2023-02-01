export class LimittedValue {
    public min: number;
    public max: number;
    public value: number;
    private _alias: string;
    private _prev: number = -1;

    constructor(alias: string, min: number, max: number, value: number) {
        if (isNaN(value) || !isFinite(value)) {
            throw new Error(`[${alias}]: Invalid number value. Fail to change it.`);
        }
        if (isNaN(min) || !isFinite(min)) {
            throw new Error(`[${alias}]: Invalid number value for "min". Fail to change it.`);
        }
        if (isNaN(max) || !isFinite(max)) {
            throw new Error(`[${alias}]: Invalid number value for "max". Fail to change it.`);
        }
        this._alias = alias;
        this.max = max;
        this.min = min;
        this.value = value;
        this._prev = -1;
    }

    public set(value: number): boolean {
        if (isNaN(value) || !isFinite(value)) {
            throw new Error(`[${this._alias}]: Invalid number value. Fail to change it.`);
        }
        if (this.max !== -1 && value > this.max) {
            this.value = this.max;
            return true;
        }
        if (this.min !== -1 && value < this.min) {
            this.value = this.min;
            return true;
        }
        this.value = value;
        return false;
    }

    public setMin(value: number): void {
        if (isNaN(value) || !isFinite(value)) {
            throw new Error(`[${this._alias}]: Invalid number value for "min". Fail to change it.`);
        }
        this.min = value;
        this.set(this.value);
    }

    public setMax(value: number): void {
        if (isNaN(value) || !isFinite(value)) {
            throw new Error(`[${this._alias}]: Invalid number value for "max". Fail to change it.`);
        }
        this.max = value;
        this.set(this.value);
    }

    public toggle(): void {
        if (this.value === this.min) {
            this._prev !== -1 && this.set(this._prev);
        } else {
            this._prev = this.value;
            this.set(this.min);
        }
    }

    public occupy(): void {
        if (this.value === this.max) {
            this._prev !== -1 && this.set(this._prev);
        } else {
            this._prev = this.value;
            this.set(this.max);
        }
    }

    public to(): {
        min(): void;
        max(): void;
    } {
        return {
            min: (): void => {
                this.set(this.min);
            },
            max: (): void => {
                this.set(this.max);
            },
        };
    }

    public is(): {
        min(): boolean;
        max(): boolean;
    } {
        return {
            min: (): boolean => {
                return this.value === this.min;
            },
            max: (): boolean => {
                return this.value === this.max;
            },
        };
    }
}
