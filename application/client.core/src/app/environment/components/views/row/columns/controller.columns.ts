// tslint:disable:no-inferrable-types

import { Subject, Observable } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';

export const CDefaults = {
    width: 100,
    min: 30,
};

export interface IColumn {
    index: number;
    width: number;
    minWidth: number;
    visible: boolean;
    header: string;
    color: string | undefined;
}

export interface IColumns { [key: number]: IColumn; }

const CLocalStorageKey = '__logviewer.row.render.custom.columns';

export class ControllerColumns {

    private _columns: IColumns = {};
    private _hash: string;
    private _subjects: {
        onResized: Subject<IColumns>,
        onUpdated: Subject<IColumns>,
    } = {
        onResized: new Subject<IColumns>(),
        onUpdated: new Subject<IColumns>(),
    };

    constructor(widths: Array<{ width: number, min: number}>, headers: string[]) {
        this._hash = Toolkit.hash(headers.join(','));
        this._columns = this._getStored(headers);
        if (this._columns === undefined) {
            this._initColumns(widths, headers);
        }
    }

    public destroy() {

    }

    public getColumns(): IColumns {
        return this._columns;
    }

    public getObservable(): {
        onResized: Observable<IColumns>,
        onUpdated: Observable<IColumns>,
    } {
        return {
            onResized: this._subjects.onResized.asObservable(),
            onUpdated: this._subjects.onUpdated.asObservable(),
        };
    }

    public resize(index: number, width: number) {
        if (this._columns[index] === undefined) {
            return;
        }
        this._columns[index].width = width > this._columns[index].minWidth ? width : this._columns[index].minWidth;
        this._setStored();
        this._subjects.onResized.next(this._columns);
    }

    public setColumns(columns: IColumns) {
        this._columns = columns;
        this._setStored();
        this._subjects.onUpdated.next(this._columns);
    }

    private _getStored(headers: string[]): IColumns | undefined {
        let columns: IColumns;
        try {
            columns = JSON.parse(localStorage.getItem(this._getStorageKey()));
        } catch (e) {
            localStorage.removeItem(this._getStorageKey());
            return undefined;
        }
        if (typeof columns !== 'object' || columns === null) {
            localStorage.removeItem(this._getStorageKey());
            return undefined;
        }
        if (Object.keys(columns).length !== headers.length) {
            localStorage.removeItem(this._getStorageKey());
            return undefined;
        }
        return columns;
    }

    private _setStored() {
        localStorage.setItem(this._getStorageKey(), JSON.stringify(this._columns));
    }

    private _initColumns(widths: Array<{ width: number, min: number}>, headers: string[]) {
        this._columns = {};
        headers.forEach((header: string, index: number) => {
            this._columns[index] = {
                width: widths[index].width,
                minWidth: widths[index].min,
                header: header,
                visible: true,
                index: index,
                color: undefined,
            };
        });
    }

    private _getStorageKey(): string {
        return `${CLocalStorageKey}:${this._hash}`;
    }

}

