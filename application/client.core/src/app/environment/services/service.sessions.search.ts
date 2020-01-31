import * as Toolkit from 'chipmunk.client.toolkit';
import { IService } from '../interfaces/interface.service';
import { Observable, Subject, Subscription } from 'rxjs';
import TabsSessionsService, { ControllerSessionTabSearch } from './service.sessions.tabs';
import { ControllerSessionTab } from '../controller/controller.session.tab';
import { ControllerSessionTabSearchFilters, FiltersStorage } from '../controller/controller.session.tab.search.filters';
import { ControllerSessionTabSearchCharts, IChartRequest } from '../controller/controller.session.tab.search.charts';

export { ControllerSessionTabSearch, IChartRequest };

export class SearchSessionsService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('SearchSessionsService');
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _subscriptionsSessionSearch: { [key: string]: Subscription | undefined } = { };
    private _session: ControllerSessionTabSearch | undefined;
    private _subjects: {
        requestsUpdated: Subject<FiltersStorage>,
        onChartsUpdated: Subject<IChartRequest[]>,
    } = {
        requestsUpdated: new Subject<FiltersStorage>(),
        onChartsUpdated: new Subject<IChartRequest[]>(),
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
        requestsUpdated: Observable<FiltersStorage>,
        onChartsUpdated: Observable<IChartRequest[]>,
    } {
        return {
            requestsUpdated: this._subjects.requestsUpdated.asObservable(),
            onChartsUpdated: this._subjects.onChartsUpdated.asObservable(),
        };
    }

    public getFiltersAPI(): ControllerSessionTabSearchFilters | undefined {
        if (this._session === undefined) {
            return;
        }
        return this._session.getFiltersAPI();
    }

    public getChartsAPI(): ControllerSessionTabSearchCharts | undefined {
        if (this._session === undefined) {
            return;
        }
        return this._session.getChartsAPI();
    }

    private _bindSearchSessionEvents() {
        this._unbindSearchSeassionEvents();
        if (this._session === undefined) {
            return;
        }
        this._subscriptionsSessionSearch.onRequestsUpdated = this._session.getFiltersAPI().getObservable().updated.subscribe(this._onRequestsUpdated.bind(this));
        this._subscriptionsSessionSearch.onChartsUpdated = this._session.getChartsAPI().getObservable().onChartsUpdated.subscribe(this._onChartsUpdated.bind(this));
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
        this._subjects.requestsUpdated.next(this._session.getFiltersAPI().getStorage());
    }

    private _onRequestsUpdated(storage: FiltersStorage) {
        this._subjects.requestsUpdated.next(storage);
    }

    private _onChartsUpdated(requests: IChartRequest[]) {
        this._subjects.onChartsUpdated.next(requests);
    }

}

export default (new SearchSessionsService());
