import ServiceProduction from '../../services/service.production';
import Logger from '../../tools/env.logger';

export interface IRange {
    from: number;
    to: number;
}

export interface IMapItem {
    rows: IRange;
    bytes: IRange;
}

const COptions = {
    // In developing mode will validate whole map with each N adding map-item operation
    validateOnEachPush: 100,
};

export default class BytesRowsMap {

    private _map: IMapItem[] = [];
    private _bytes: number = 0;
    private _rows: number = 0;
    private _logger: Logger = new Logger(`StreamBytesRowsMap`);
    private _debugging: {
        validateOnEachPushIndex: number,
    } = {
        validateOnEachPushIndex: 0,
    };

    public destroy() {
        this.drop();
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

    public add(item: IMapItem) {
        if (item.bytes.from === item.bytes.to ||
            item.bytes.from < 0 ||
            item.bytes.to < 0 ||
            item.rows.from < 0 ||
            item.rows.to < 0) {
            return this._logger.error(`Attempt to add not valid map item: ${JSON.stringify(item)}`);
        }
        this._map.push(item);
        this._bytes = item.bytes.to + 1;
        this._rows = item.rows.to + 1;
        this.validate();
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

    public drop() {
        this._map = [];
        this._bytes = 0;
        this._rows = 0;
    }

    public validate(): string[] | undefined {
        if (ServiceProduction.isProduction()) {
            return;
        }
        if (this._debugging.validateOnEachPushIndex < COptions.validateOnEachPush) {
            this._debugging.validateOnEachPushIndex += 1;
            return;
        }
        this._debugging.validateOnEachPushIndex = 0;
        const errors: string[] = [];
        this._map.forEach((item: IMapItem, i: number) => {
            if (i !== 0) {
                if (this._map[i].bytes.from !== this._map[i - 1].bytes.to + 1) {
                    errors.push(`Indexes ${i - 1}:${this._map[i - 1].bytes.to + 1}-${i}:${this._map[i].bytes.from} :: bytes dismiss`);
                }
                if (this._map[i].rows.from !== this._map[i - 1].rows.to + 1) {
                    errors.push(`Indexes ${i - 1}:${this._map[i - 1].rows.to + 1}-${i}:${this._map[i].rows.from} :: rows dismiss`);
                }
            }
            if (item.bytes.from >= item.bytes.to) {
                errors.push(`Index ${i} :: wrong bytes position: { from: ${item.bytes.from}, to: ${item.bytes.to}}`);
            }
            if (item.rows.from > item.rows.to) {
                errors.push(`Index ${i} :: wrong rows position: { from: ${item.rows.from}, to: ${item.rows.to}}`);
            }
        });
        if (errors.length === 0) {
            this._logger.debug(`map is checked. All good.`);
            return;
        }
        this._logger.error(`${'='.repeat(20)}\n${errors.join('\n')}\n${'='.repeat(20)}`);
        return errors;
    }

}
