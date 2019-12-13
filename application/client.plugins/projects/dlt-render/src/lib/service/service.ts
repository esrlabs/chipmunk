// tslint:disable:max-line-length
import * as Toolkit from 'chipmunk.client.toolkit';
import { isDLTSource } from '../render/row.columns';
import { Observable, Subject } from 'rxjs';

export class Service extends Toolkit.APluginService {

    private api: Toolkit.IAPI | undefined;
    private _subscriptions: { [key: string]: Toolkit.Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Toolkit.Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger(`DLT Render Service`);
    private _session: string | undefined;
    private _subjects = {
        event: new Subject<any>(),
    };

    constructor() {
        super();
        this._subscriptions.onAPIReady = this.onAPIReady.subscribe(this._onAPIReady.bind(this));
    }

    public getObservable(): {
        event: Observable<any>,
    } {
        return {
            event: this._subjects.event.asObservable(),
        };
    }

    private _onAPIReady() {
        this.api = this.getAPI();
        if (this.api === undefined) {
            this._logger.error('API not found!');
            return;
        }
        this._subscriptions.onSessionClose = this.api.getSessionsEventsHub().subscribe().onSessionClose(this._onSessionClose.bind(this));
        this._subscriptions.onSessionChange = this.api.getSessionsEventsHub().subscribe().onSessionChange(this._onSessionChange.bind(this));
    }

    private _onRowSelected(event: Toolkit.IOnRowSelectedEvent) {
        if (!isDLTSource(event.source.name)) {
            return;
        }
        this.api.openSidebarApp('dlt-render', true);
    }

    private _onSessionChange(guid: string) {
        this._session = guid;
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].unsubscribe();
        });
        const EventsHub = this.api.getViewportEventsHub();
        if (EventsHub === undefined) {
            return;
        }
        this._sessionSubscriptions.onRowSelected = EventsHub.getSubject().onRowSelected.subscribe(this._onRowSelected.bind(this));
    }

    private _onSessionClose(guid: string) {
        if (this._session !== guid) {
            return;
        }
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].unsubscribe();
        });
    }

}

export default (new Service());
