import { Subject, Observable } from 'rxjs';
import { SafeHtml } from '@angular/platform-browser';

export interface IColumnsWidths {
    [key: number]: number;
}

export interface IColumnsWidthsChanged {
    widths: IColumnsWidths;
    emitter: string;
}

export interface IColumnValue {
    str: string;
    html: SafeHtml;
}

export const CDefaults = {
    width: 100,
    min: 30,
};

export const CDefaultByColumns = [
    { width: 150, min: 30 },
    { width: 50, min: 30 },
    { width: 20, min: 20 },
    { width: 50, min: 30 },
    { width: 40, min: 30 },
    { width: 70, min: 30 },
    { width: 50, min: 30 },
    { width: 50, min: 30 },
    { width: 50, min: 30 },
    { width: 50, min: 30 },
    { width: 1000, min: 100 },
];

export const CDelimiters = {
    columns: '\u0004',
    arguments: '\u0005',
};
/*
/// EColumn.DATETIME,
/// EColumn.ECUID,
/// EColumn.VERS,
/// EColumn.SID,
/// EColumn.MCNT,
/// EColumn.TMS,
/// EColumn.EID,
/// EColumn.APID,
/// EColumn.CTID,
/// EColumn.MSTP,
/// EColumn.PAYLOAD
*/

class ServiceColumns {

    private _widths: IColumnsWidths = {};
    private _selected: IColumnValue[] = [];
    private _subjects: {
        onColumnsResized: Subject<IColumnsWidthsChanged>,
        onSelected: Subject<IColumnValue[]>,
    } = {
        onColumnsResized: new Subject<IColumnsWidthsChanged>(),
        onSelected: new Subject<IColumnValue[]>(),
    };

    public getWidths(columns: number): IColumnsWidths {
        if (Object.keys(this._widths).length < columns) {
            for (let i = Object.keys(this._widths).length; i <= columns; i += 1) {
                const defaults = CDefaultByColumns[i] !== undefined ? CDefaultByColumns[i] : CDefaults;
                this._widths[i] = defaults.width;
            }
        }
        return Object.assign({}, this._widths);
    }

    public getSelected(): IColumnValue[] {
        return this._selected.slice();
    }

    public getObservable(): {
        onColumnsResized: Observable<IColumnsWidthsChanged>,
        onSelected: Observable<IColumnValue[]>,
    } {
        return {
            onColumnsResized: this._subjects.onColumnsResized.asObservable(),
            onSelected: this._subjects.onSelected.asObservable(),
        };
    }

    public emit(options: {
        widths?: IColumnsWidths,
        selected?: IColumnValue[],
    }): {
        onColumnsResized: Subject<IColumnsWidthsChanged>,
        onSelected: Subject<IColumnValue[]>,
    } {
        if (options.widths !== undefined && Object.keys(options.widths).length === Object.keys(this._widths).length) {
            this._widths = Object.assign({}, options.widths);
        }
        if (options.selected !== undefined) {
            this._selected = options.selected;
        }
        return this._subjects;
    }
}

export default new ServiceColumns();
