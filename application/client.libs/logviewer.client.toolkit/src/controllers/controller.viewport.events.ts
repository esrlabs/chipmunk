import { Subscription, Observable, Subject} from 'rxjs-compat';

export interface ISourceInfo {
    id: number;
    name: string;
}

export interface IOnRowSelectedEvent {
    session: string;
    source: ISourceInfo;
    row: number;
    str: string;
}

export class ControllerViewportEvents {

    private _subscriptions: { [key: string]: Subscription } = { };
    private _subjects: {
        onRowSelected: Subject<IOnRowSelectedEvent>,
    } = {
        onRowSelected: new Subject<IOnRowSelectedEvent>(),
    };

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public getObservable(): {
        onRowSelected: Observable<IOnRowSelectedEvent>,
    } {
        return {
            onRowSelected: this._subjects.onRowSelected.asObservable(),
        };
    }

    public getSubject(): {
        onRowSelected: Subject<IOnRowSelectedEvent>,
    } {
        return this._subjects;
    }

}
