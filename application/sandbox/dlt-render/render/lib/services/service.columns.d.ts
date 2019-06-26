import { Subject, Observable } from 'rxjs';
export interface IColumnsWidths {
    [key: number]: number;
}
export interface IColumnsWidthsChanged {
    widths: IColumnsWidths;
    emitter: string;
}
export declare const CDefaults: {
    width: number;
    min: number;
};
declare class ServiceColumns {
    private _widths;
    private _subjects;
    getWidths(columns: number): IColumnsWidths;
    getObservable(): {
        onColumnsResized: Observable<IColumnsWidthsChanged>;
    };
    emit(widths: IColumnsWidths): {
        onColumnsResized: Subject<IColumnsWidthsChanged>;
    };
}
declare const _default: ServiceColumns;
export default _default;
