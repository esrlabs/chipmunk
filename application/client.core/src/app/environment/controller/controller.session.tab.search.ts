import { ControllerSessionTabSearchFilters, FilterRequest } from './controller.session.tab.search.filters';
import { ControllerSessionTabSearchCharts } from './controller.session.tab.search.charts';
import { ControllerSessionTabSearchOutput } from './controller.session.tab.search.output';
import { ControllerSessionTabStreamOutput } from './controller.session.tab.stream.output';
import { ControllerSessionTabSearchRecent } from './controller.session.tab.search.recent';
import { ControllerSessionScope } from './controller.session.tab.scope';
import { Subject, Observable } from 'rxjs';
import * as Toolkit from 'chipmunk.client.toolkit';

export interface IControllerSessionStream {
    guid: string;
    stream: ControllerSessionTabStreamOutput;
    scope: ControllerSessionScope;
}

export class ControllerSessionTabSearch {

    private _logger: Toolkit.Logger;
    private _filters: ControllerSessionTabSearchFilters;
    private _charts: ControllerSessionTabSearchCharts;
    private _recent: ControllerSessionTabSearchRecent;
    private _subjects: {
        search: Subject<FilterRequest>,
    } = {
        search: new Subject<FilterRequest>(),
    };
    private _guid: string;

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearch: ${params.guid}`);
        this._filters = new ControllerSessionTabSearchFilters(params);
        this._charts = new ControllerSessionTabSearchCharts(params);
        this._recent = new ControllerSessionTabSearchRecent(
            params.guid,
            this._filters.getStorage(),
            this._charts.getStorage(),
        );
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                this._filters.destroy(),
                this._charts.destroy(),
                this._recent.destroy(),
            ]).then(() => {
                resolve();
            });
        });
    }

    public getGuid(): string {
        return this._guid;
    }

    public getObservable(): {
        search: Observable<FilterRequest>,
    } {
        return {
            search: this._subjects.search.asObservable(),
        };
    }

    public getOutputStream(): ControllerSessionTabSearchOutput {
        return this._filters.getOutputStream();
    }

    public getFiltersAPI(): ControllerSessionTabSearchFilters {
        return this._filters;
    }

    public getChartsAPI(): ControllerSessionTabSearchCharts {
        return this._charts;
    }

    public getRecentAPI(): ControllerSessionTabSearchRecent {
        return this._recent;
    }

    public search(request: FilterRequest) {
        this._subjects.search.next(request);
    }

}
