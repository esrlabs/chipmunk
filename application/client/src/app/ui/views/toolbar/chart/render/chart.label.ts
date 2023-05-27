export class Label {
    public readonly value: string;
    public readonly candle: boolean;
    constructor(
        public readonly color: string,
        value: number,
        public readonly position: number,
        public readonly min: number,
        public readonly max: number,
    ) {
        this.candle = !(min === value && max === value);
        this.value = value.toFixed(2);
    }
}
