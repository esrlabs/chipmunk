import * as Toolkit from 'chipmunk.client.toolkit';
import { DLTRowColumnsAPI } from './row.columns.api';

export function isDLTSource(sourceName: string, sourceMeta?: string): boolean {
    if (typeof sourceName !== 'string') {
        return false;
    }
    if (typeof sourceMeta === 'string' && sourceMeta.toLowerCase().indexOf('dlt') === 0) {
        return true;
    }
    if (sourceName.search(/\.dlt$/gi) === -1 && sourceName.search(/\u0011dlt\u0011/gi) === -1) {
        return false;
    }
    return true;
}

export class DLTRowColumns extends Toolkit.ATypedRowRender<DLTRowColumnsAPI> {

    private _api: DLTRowColumnsAPI = new DLTRowColumnsAPI();

    constructor() {
        super();
    }

    public getType(): Toolkit.ETypedRowRenders {
        return Toolkit.ETypedRowRenders.columns;
    }

    public isTypeMatch(sourceName: string, sourceMeta?: string): boolean {
        return isDLTSource(sourceName, sourceMeta);
    }

    public getAPI(): DLTRowColumnsAPI {
        return this._api;
    }

}
