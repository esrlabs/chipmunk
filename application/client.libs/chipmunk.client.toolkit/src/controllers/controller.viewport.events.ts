import Subscription from '../tools/tools.subscription';
import Subject from '../tools/tools.subject';

export interface ISourceInfo {
    id: number;
    name: string | undefined;
    meta?: string;
}

export interface IOnRowSelectedEvent {
    session: string;
    source: ISourceInfo;
    row: number;
    str: string;
}

/**
 * This class provides access to viewport events.
 *
 * @usecases to track sessions state
 * @class ControllerSessionsEvents
 */
export class ControllerViewportEvents {

    private _subscriptions: { [key: string]: Subscription } = { };
    private _subjects: {
        /**
         * Fired on user selected row in main view
         * @name onRowSelected
         * @event {IOnRowSelectedEvent}
         */
        onRowSelected: Subject<IOnRowSelectedEvent>,
    } = {
        onRowSelected: new Subject<IOnRowSelectedEvent>(),
    };
    private _selected: IOnRowSelectedEvent | undefined;

    constructor() {
        this._subscriptions.onRowSelected = this.getSubject().onRowSelected.subscribe((event: IOnRowSelectedEvent) => {
            this._selected = event;
        });
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public subscribe(): {
        onRowSelected: (handler: (event: IOnRowSelectedEvent) => void) => Subscription;
    } {
        return {
            onRowSelected: (handler: (event: IOnRowSelectedEvent) => void) => {
                return this._subjects.onRowSelected.subscribe(handler);
            },
        }
    }

    // Will be deprecated
    public getSubject(): {
        onRowSelected: Subject<IOnRowSelectedEvent>,
    } {
        return this._subjects;
    }

    public drop() {
        this._selected = undefined;
    }

    public getSelected(): IOnRowSelectedEvent | undefined {
        return this._selected;
    }

}
