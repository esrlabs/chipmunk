import { Subject, Observable } from 'rxjs';

export interface IColumnsWidths {
    [key: number]: number;
}

export interface IColumnsWidthsChanged {
    widths: IColumnsWidths;
    emitter: string;
}

export const CDefaults = {
    width: 100,
    min: 30,
};

class ServiceColumns {

    private _widths: IColumnsWidths = {};
    private _subjects: {
        onColumnsResized: Subject<IColumnsWidthsChanged>,
    } = {
        onColumnsResized: new Subject<IColumnsWidthsChanged>(),
    };

    public getWidths(columns: number): IColumnsWidths {
        if (Object.keys(this._widths).length < columns) {
            for (let i = Object.keys(this._widths).length; i <= columns; i += 1) {
                this._widths[i] = CDefaults.width;
            }
        }
        return Object.assign({}, this._widths);
    }

    public getObservable(): {
        onColumnsResized: Observable<IColumnsWidthsChanged>
    } {
        return {
            onColumnsResized: this._subjects.onColumnsResized.asObservable(),
        };
    }

    public emit(widths: IColumnsWidths): {
        onColumnsResized: Subject<IColumnsWidthsChanged>,
    } {
        if (Object.keys(widths).length === Object.keys(this._widths).length) {
            this._widths = Object.assign({}, widths);
        }
        return this._subjects;
    }
}

export default new ServiceColumns();
