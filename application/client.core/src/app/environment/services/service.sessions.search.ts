import * as Toolkit from 'logviewer.client.toolkit';
import { IService } from '../interfaces/interface.service';
import { Observable, Subject, Subscription } from 'rxjs';
import TabsSessionsService, { ControllerSessionTabSearch, IRequest } from './service.sessions.tabs';
import { ControllerSessionTab } from '../controller/controller.session.tab';

export { ControllerSessionTabSearch, IRequest };

type TSessionGuid = string;

export class SearchSessionsService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('SearchSessionsService');
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _subscriptionsSessionSearch: { [key: string]: Subscription | undefined } = { };
    private _session: ControllerSessionTabSearch | undefined;
    private _subjects: {
        onRequestsUpdated: Subject<IRequest[]>
    } = {
        onRequestsUpdated: new Subject<IRequest[]>()
    };

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (TabsSessionsService.getActive() !== undefined) {
                this._session = TabsSessionsService.getActive().getSessionSearch();
                if (this._session === undefined) {
                    this._logger.warn(`Cannot find active (default) session.`);
                } else {
                    this._bindSearchSessionEvents();
                }
            }
            this._subscriptions.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
            resolve();
        });
    }

    public getName(): string {
        return 'SearchSessionsService';
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._unbindSearchSeassionEvents();
    }

    public getObservable(): {
        onRequestsUpdated: Observable<IRequest[]>
    } {
        return {
            onRequestsUpdated: this._subjects.onRequestsUpdated.asObservable()
        };
    }

    public getStoredRequests(): IRequest[] {
        if (this._session === undefined) {
            return [];
        }
        return this._session.getStored();
    }

    public removeStoredRequest(request: string) {
        if (this._session === undefined) {
            return;
        }
        this._session.removeStored(request);
    }

    public removeAllStoredRequests() {
        if (this._session === undefined) {
            return;
        }
        this._session.removeAllStored();
    }

    public insertStoredRequests(requests: IRequest[]) {
        if (this._session === undefined) {
            return;
        }
        this._session.insertStored(requests);
    }

    public updateRequest(request: string, updated: { reguest?: string, color?: string, background?: string, active?: boolean }) {
        if (this._session === undefined) {
            return;
        }
        this._session.updateStored(request, updated);
    }

    private _bindSearchSessionEvents() {
        this._unbindSearchSeassionEvents();
        if (this._session === undefined) {
            return;
        }
        this._subscriptionsSessionSearch.onRequestsUpdated = this._session.getObservable().onRequestsUpdated.subscribe(this._onRequestsUpdated.bind(this));
    }

    private _unbindSearchSeassionEvents() {
        Object.keys(this._subscriptionsSessionSearch).forEach((key: string) => {
            this._subscriptionsSessionSearch[key].unsubscribe();
        });
    }

    private _onSessionChange() {
        const session: ControllerSessionTab | undefined = TabsSessionsService.getActive();
        if (session === undefined) {
            this._unbindSearchSeassionEvents();
            this._session = undefined;
            return;
        }
        this._session = session.getSessionSearch();
        if (this._session === undefined) {
            return this._logger.warn(`Cannot get active session, after it was changed.`);
        }
        this._bindSearchSessionEvents();
        this._subjects.onRequestsUpdated.next(this._session.getStored());
    }

    private _onRequestsUpdated(requests: IRequest[]) {
        this._subjects.onRequestsUpdated.next(requests);
    }

}

export default (new SearchSessionsService());
