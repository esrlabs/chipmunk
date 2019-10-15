import * as Toolkit from 'logviewer.client.toolkit';
import { Observable, Subscription, Subject } from 'rxjs';

export interface IPositionChange {
    left: number;
    width: number;
    full: number;
}

export class ServicePosition {

    private _position: IPositionChange | undefined;
    private _subjects: {
        onChange: Subject<IPositionChange>,
    } = {
        onChange: new Subject<IPositionChange>(),
    };

    constructor() {

    }

    public destroy() {
        Object.keys(this._subjects).forEach((key: string) => {
            this._subjects[key].unsubscribe();
        });
    }

    public set(position: IPositionChange) {
        this._position = position;
        // To make it asynch
        this._subjects.onChange.next(position);
    }

    public get(): IPositionChange | undefined {
        return this._position;
    }

    public getObservable(): {
        onChange: Observable<IPositionChange>,
    } {
        return {
            onChange: this._subjects.onChange.asObservable(),
        };
    }

}
