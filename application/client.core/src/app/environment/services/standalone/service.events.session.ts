import { Subscription, Observable, Subject } from 'rxjs';
import { Session } from '../../controller/session/session';
import { IComponentDesc } from 'chipmunk.client.toolkit';

import * as Toolkit from 'chipmunk.client.toolkit';

export class EventsSessionService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('EventsSessionService');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _subjects: {
        onSessionChange: Subject<Session | undefined>;
        onSessionClosed: Subject<string>;
        onSidebarTitleInjection: Subject<IComponentDesc | undefined>;
    } = {
        onSessionChange: new Subject<Session | undefined>(),
        onSessionClosed: new Subject<string>(),
        onSidebarTitleInjection: new Subject<IComponentDesc | undefined>(),
    };

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public getObservable(): {
        onSessionChange: Observable<Session | undefined>;
        onSessionClosed: Observable<string>;
        onSidebarTitleInjection: Observable<IComponentDesc | undefined>;
    } {
        return {
            onSessionChange: this._subjects.onSessionChange.asObservable(),
            onSessionClosed: this._subjects.onSessionClosed.asObservable(),
            onSidebarTitleInjection: this._subjects.onSidebarTitleInjection.asObservable(),
        };
    }

    public getSubject(): {
        onSessionChange: Subject<Session | undefined>;
        onSessionClosed: Subject<string>;
        onSidebarTitleInjection: Subject<IComponentDesc | undefined>;
    } {
        return this._subjects;
    }
}

export default new EventsSessionService();
