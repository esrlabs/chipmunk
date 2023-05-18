import { ChartRequest } from '@service/session/dependencies/search/charts/request';

export type TChartValues = [string, number, number][];

export class ChartCoors {
    static DEFAULT_OFFSET_AROUND = 3;

    protected coors: Map<number, TChartValues> = new Map();

    public drop(): void {
        this.coors.clear();
    }

    public add(x: number, value: number, row: number, request: ChartRequest | undefined): void {
        if (request === undefined) {
            return;
        }
        let values = this.coors.get(x);
        if (values === undefined) {
            values = [];
        }
        values.push([request.definition.color, value, row]);
        this.coors.set(x, values);
    }

    public get(x: number, offset = ChartCoors.DEFAULT_OFFSET_AROUND): TChartValues {
        const left = x - offset;
        const right = x + offset;
        let closed: number | undefined = undefined;
        let distance: number = Infinity;
        Array.from(this.coors.keys())
            .filter((k) => k >= left && k <= right)
            .forEach((k) => {
                const dist = Math.abs(k - x);
                if (dist < distance) {
                    closed = k;
                    distance = dist;
                }
            });
        if (closed === undefined) {
            return [];
        }
        const values = this.coors.get(closed);
        return values === undefined ? [] : values;
    }
}
