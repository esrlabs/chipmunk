import Subscription from '../tools/tools.subscription';
import Subject from '../tools/tools.subject';

export interface ISourceInfo {
    id: number;
    name: string | undefined;
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

    public getSubject(): {
        onRowSelected: Subject<IOnRowSelectedEvent>,
    } {
        return this._subjects;
    }

}
