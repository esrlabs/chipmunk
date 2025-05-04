import { DictionaryEntities } from './structure/statentity';

const ROWS = 3;

export class Summary {
    public rows: Map<string, number>[] = [];

    protected convert(data: Map<string, number>) {
        const perRows = Math.floor(data.size / ROWS);
        let row = 0;
        data.forEach((value, key) => {
            if (!this.rows[row]) {
                this.rows.push(new Map());
            }
            this.rows[row].set(key, value);
            if (this.rows[row].size >= perRows) {
                row += 1;
            }
        });
    }

    protected getRow(key: string): Map<string, number> | undefined {
        return this.rows.find((row) => row.has(key));
    }

    constructor(data: Map<string, number>) {
        this.convert(data);
    }

    public inc(entity: DictionaryEntities) {
        entity.data.forEach((value: string | number, key: string) => {
            const row = this.getRow(key);
            if (!row) {
                return;
            }
            const current = row.get(key);
            if (typeof value === 'number') {
                row.set(key, current ? value + current : value);
            } else {
                row.set(key, current ? current + 1 : 1);
            }
        });
    }

    public reset() {
        this.rows.forEach((row) => row.keys().forEach((key) => row.set(key, 0)));
    }

    public count(): number {
        return this.rows.map((row) => row.size).reduce((acc, val) => acc + val, 0);
    }
}
