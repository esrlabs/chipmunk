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
export declare const CDefaults: {
    width: number;
    min: number;
};
export declare const CDefaultByColumns: {
    width: number;
    min: number;
}[];
export declare const CDelimiters: {
    columns: string;
    arguments: string;
};
declare class ServiceColumns {
    private _widths;
    private _selected;
    private _subjects;
    getWidths(columns: number): IColumnsWidths;
    getSelected(): IColumnValue[];
    getObservable(): {
        onColumnsResized: Observable<IColumnsWidthsChanged>;
        onSelected: Observable<IColumnValue[]>;
    };
    emit(options: {
        widths?: IColumnsWidths;
        selected?: IColumnValue[];
    }): {
        onColumnsResized: Subject<IColumnsWidthsChanged>;
        onSelected: Subject<IColumnValue[]>;
    };
}
declare const _default: ServiceColumns;
export default _default;
