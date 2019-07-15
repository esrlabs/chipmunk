// tslint:disable:no-inferrable-types

import { Subject, Observable } from 'rxjs';

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
}

export interface IColumns { [key: number]: IColumn; }

export class ControllerColumns {

    private _columns: IColumns = {};
    private _subjects: {
        onResized: Subject<IColumns>,
        onVisibility: Subject<IColumns>,
    } = {
        onResized: new Subject<IColumns>(),
        onVisibility: new Subject<IColumns>(),
    };

    constructor(widths: Array<{ width: number, min: number}>, headers: string[]) {
        headers.forEach((header: string, index: number) => {
            this._columns[index] = {
                width: widths[index].width,
                minWidth: widths[index].min,
                header: header,
                visible: true,
                index: index,
            };
        });
    }

    public getColumns(): IColumns {
        return this._columns;
    }

    public getObservable(): {
        onResized: Observable<IColumns>,
        onVisibility: Observable<IColumns>,
    } {
        return {
            onResized: this._subjects.onResized.asObservable(),
            onVisibility: this._subjects.onVisibility.asObservable(),
        };
    }

    public resize(index: number, width: number) {
        if (this._columns[index] === undefined) {
            return;
        }
        this._columns[index].width = width > this._columns[index].minWidth ? width : this._columns[index].minWidth;
        this._subjects.onResized.next(this._columns);
    }

    public setColumnsVisibility(visibility: boolean[]) {
        visibility.forEach((visibile: boolean, index: number) => {
            if (this._columns[index] === undefined) {
                return;
            }
            this._columns[index].visible = visibile;
        });
        this._subjects.onVisibility.next(this._columns);
    }
}

