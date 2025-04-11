import { getContrastColor } from '@ui/styles/colors';

export class Label {
    public readonly value: string;
    public readonly candle: boolean;
    public readonly color: string;
    constructor(
        public readonly bk: string,
        value: number,
        public readonly position: number,
        public readonly min: number,
        public readonly max: number,
    ) {
        this.color = getContrastColor(bk, true);
        this.candle = !(min === value && max === value);
        this.value = value.toFixed(2);
    }
}
