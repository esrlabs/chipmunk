// tslint:disable:no-inferrable-types

import { Subject, Observable } from 'rxjs';
import * as Toolkit from 'chipmunk.client.toolkit';

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

const CLocalStorageKey = '__logviewer.row.render.custom.columns';

export class ControllerColumns {
    private _columns: IColumn[] | undefined = [];
    private _hash: string;
    private _defaultColor: string = '#eaeaea';
    private _subjects: {
        onResized: Subject<IColumn[]>;
        onUpdated: Subject<IColumn[]>;
    } = {
        onResized: new Subject<IColumn[]>(),
        onUpdated: new Subject<IColumn[]>(),
    };

    constructor(widths: Array<{ width: number; min: number }>, headers: string[]) {
        this._hash = Toolkit.hash(headers.join(','));
        this._columns = this._getStored(headers);
        if (!(this._columns instanceof Array)) {
            this._columns = undefined;
        }
        if (this._columns === undefined) {
            this._initColumns(widths, headers);
        }
    }

    public destroy() {}

    public getColumns(): IColumn[] {
        return this._columns === undefined
            ? []
            : this._columns.map((column: IColumn) => {
                  return Object.assign({}, column);
              });
    }

    public getObservable(): {
        onResized: Observable<IColumn[]>;
        onUpdated: Observable<IColumn[]>;
    } {
        return {
            onResized: this._subjects.onResized.asObservable(),
            onUpdated: this._subjects.onUpdated.asObservable(),
        };
    }

    public resize(index: number, width: number) {
        if (this._columns === undefined || this._columns[index] === undefined) {
            return;
        }
        this._columns[index].width =
            width > this._columns[index].minWidth ? width : this._columns[index].minWidth;
        this._setStored();
        this._subjects.onResized.next(this._columns);
    }

    public setColumns(columns: IColumn[]) {
        this._columns = columns;
        this._setStored();
        this._subjects.onUpdated.next(this._columns);
    }

    private _getStored(headers: string[]): IColumn[] | undefined {
        let columns: IColumn[];
        try {
            const stored = localStorage.getItem(this._getStorageKey());
            if (stored === null) {
                return undefined;
            }
            columns = JSON.parse(stored);
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

    private _initColumns(widths: Array<{ width: number; min: number }>, headers: string[]) {
        this._columns = [];
        const columns: IColumn[] = [];
        headers.forEach((header: string, index: number) => {
            columns.push({
                width: widths[index].width,
                minWidth: widths[index].min,
                header: header,
                visible: true,
                index: index,
                color: this._defaultColor,
            });
        });
        this._columns = columns;
    }

    private _getStorageKey(): string {
        return `${CLocalStorageKey}:${this._hash}`;
    }
}
