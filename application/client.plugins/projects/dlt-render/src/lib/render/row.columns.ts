import * as Toolkit from 'logviewer.client.toolkit';
import { DLTRowColumnsAPI } from './row.columns.api';

export class DLTRowColumns extends Toolkit.ATypedRowRender<DLTRowColumnsAPI> {

    private _api: DLTRowColumnsAPI = new DLTRowColumnsAPI();

    constructor() {
        super();
    }

    public getType(): Toolkit.ETypedRowRenders {
        return Toolkit.ETypedRowRenders.columns;
    }

    public isTypeMatch(sourceName: string): boolean {
        if (typeof sourceName !== 'string') {
            return false;
        }
        if (sourceName.search(/\.dlt$/gi) === -1) {
            return false;
        }
        return true;
    }

    public getAPI(): DLTRowColumnsAPI {
        return this._api;
    }

}
