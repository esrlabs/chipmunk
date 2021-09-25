import * as Toolkit from 'chipmunk.client.toolkit';
import { Subscription, Observable, Subject } from 'rxjs';

export class EventsHubService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('EventsHubService');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _subjects: {
        onKeepScrollPrevent: Subject<string | undefined>;
    } = {
        onKeepScrollPrevent: new Subject<string | undefined>(),
    };

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public getObservable(): {
        onKeepScrollPrevent: Observable<string | undefined>;
    } {
        return {
            onKeepScrollPrevent: this._subjects.onKeepScrollPrevent.asObservable(),
        };
    }

    public getSubject(): {
        onKeepScrollPrevent: Subject<string | undefined>;
    } {
        return this._subjects;
    }
}

export default new EventsHubService();
