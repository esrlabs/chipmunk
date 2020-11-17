import { IPCMessages, Subscription } from './service.electron.ipc';
import { Observable, Subject } from 'rxjs';

import * as Toolkit from 'chipmunk.client.toolkit';

export class FocusOutputService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('FocusOutputService');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _subjects: {
        onFocus: Subject<void>,
    } = {
        onFocus: new Subject<void>(),
    };

    constructor() { }

    public getObservable(): {
        onFocus: Observable<void>,
    } {
        return {
            onFocus: this._subjects.onFocus.asObservable(),
        };
    }

    public getName(): string {
        return 'FocusOutputService';
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            resolve();
        });
    }

    public focus() {
        return this._subjects.onFocus.next();
    }

}

export default (new FocusOutputService());
