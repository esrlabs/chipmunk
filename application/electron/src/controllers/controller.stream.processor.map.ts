export interface IRange {
    from: number;
    to: number;
}

export interface IMapItem {
    rows: IRange;
    bytes: IRange;
}

const CSettings = {
    minChunkRowsCount: 500,
};

export default class BytesRowsMap {

    private _map: IMapItem[] = [];
    private _bytes: number = 0;
    private _rows: number = 0;

    public destroy() {
        this._map = [];
        this._bytes = 0;
        this._rows = 0;
    }

    public rewrite(map: IMapItem[]) {
        this._map = map;
        this._rows = map[map.length - 1].rows.to + 1;
        this._bytes = map[map.length - 1].bytes.to + 1;
    }

    public push(items: IMapItem[]) {
        this._map.push(...items);
        this._rows = this._map[this._map.length - 1].rows.to + 1;
        this._bytes = this._map[this._map.length - 1].bytes.to + 1;
    }

    public add(item: IMapItem | IMapItem[]) {
        item = item instanceof Array ? item : [item];
        this._map.push(...item);
        this._bytes = item[item.length - 1].bytes.to + 1;
        this._rows = item[item.length - 1].rows.to + 1;
    }

    public getBytesRange(requested: IRange): IMapItem | Error {
        const bytes: IRange = { from: -1, to: -1 };
        const rows: IRange = { from: -1, to: -1 };
        for (let i = 0, max = this._map.length - 1; i <= max; i += 1) {
            const range: IMapItem = this._map[i];
            if (bytes.from === -1 && requested.from <= range.rows.from) {
                if (i > 0) {
                    bytes.from = this._map[i - 1].bytes.from;
                    rows.from = this._map[i - 1].rows.from;
                } else {
                    bytes.from = range.bytes.from;
                    rows.from = range.rows.from;
                }
            }
            if (bytes.to === -1 && requested.to <= range.rows.to) {
                if (i < this._map.length - 1) {
                    bytes.to = this._map[i + 1].bytes.to;
                    rows.to = this._map[i + 1].rows.to;
                } else {
                    bytes.to = range.bytes.to;
                    rows.to = range.rows.to;
                }
            }
            if (bytes.from !== -1 && bytes.to !== -1) {
                break;
            }
        }
        if (bytes.from === -1 && bytes.to !== -1) {
            // In loop this use-case is missed
            const range: IMapItem = this._map[this._map.length - 1];
            if (requested.from > range.rows.from) {
                bytes.from = range.bytes.from;
                rows.from = range.rows.from;
            }
        }
        if (bytes.to === -1 || bytes.from === -1) {
            return new Error(`Fail to calculate bytes range with rows range: (${requested.from} - ${requested.to}).`);
        }
        return { bytes: bytes, rows: rows };
    }

    public getByteLength(): number {
        return this._bytes;
    }

    public getRowsCount(): number {
        return this._rows;
    }
/*
    public getLastRange(): IMapItem | Error {
        if (this._map.length === 0) {
            return new Error(`No data in file. File is empty.`);
        }
        const to: number = this._map.length - 1;
        let from: number = to;
        for (let i = from; i >= 0; i -= 1) {
            if (this._map[to].rows.to - this._map[from].rows.from >= CSettings.minChunkRowsCount) {
                from = i;
                break;
            }
            from = i;
        }
        return {
            bytes: { from: this._map[from].bytes.from, to: this._map[to].bytes.to },
            rows: { from: this._map[from].rows.from, to: this._map[to].rows.to },
        };
    }
*/
}
