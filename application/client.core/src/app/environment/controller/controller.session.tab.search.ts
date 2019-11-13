import { ControllerSessionTabSearchFilters } from './controller.session.tab.search.filters';
import { ControllerSessionTabSearchCharts } from './controller.session.tab.search.charts';
import { ControllerSessionTabSearchOutput } from './controller.session.tab.search.output';
import { ControllerSessionTabStreamOutput } from './controller.session.tab.stream.output';
import { ControllerSessionScope } from './controller.session.tab.scope';
import * as Toolkit from 'chipmunk.client.toolkit';

export interface IControllerSessionStream {
    guid: string;
    stream: ControllerSessionTabStreamOutput;
    transports: string[];
    scope: ControllerSessionScope;
}

export class ControllerSessionTabSearch {

    private _logger: Toolkit.Logger;
    private _filters: ControllerSessionTabSearchFilters;
    private _charts: ControllerSessionTabSearchCharts;
    private _guid: string;

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearch: ${params.guid}`);
        this._filters = new ControllerSessionTabSearchFilters(params);
        this._charts = new ControllerSessionTabSearchCharts(params);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                this._filters.destroy(),
                this._charts.destroy(),
            ]).then(() => {
                resolve();
            });
        });
    }

    public getGuid(): string {
        return this._guid;
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

}
