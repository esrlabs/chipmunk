import { Observable, Subject, Subscription } from 'rxjs';
import { ControllerSessionTabStreamOutput } from './controller.session.tab.stream.output';
import { ControllerSessionScope } from './controller.session.tab.scope';
import * as Toolkit from 'chipmunk.client.toolkit';
import ServiceElectronIpc, { IPCMessages } from '../services/service.electron.ipc';
import * as ColorScheme from '../theme/colors';
import { getController, AChart, EChartType, IOptionsObj } from '../components/views/chart/charts/charts';
import OutputParsersService from '../services/standalone/service.output.parsers';

export interface IControllerSessionStreamCharts {
    guid: string;
    stream: ControllerSessionTabStreamOutput;
    transports: string[];
    scope: ControllerSessionScope;
}

export interface IChartRequest {
    reg: RegExp;
    color: string;
    type: EChartType;
    active: boolean;
    options: { [key: string]: string | number | boolean };
}

export interface IChartsOptions {
    requestId: string;
    requests: IPCMessages.IChartRegExpStr[];
}

export interface ISubjects {
    onChartsUpdated: Subject<IChartRequest[]>;
    onExtractingStarted: Subject<void>;
    onExtractingFinished: Subject<void>;
    onChartsResultsUpdated: Subject<IPCMessages.TChartResults>;
}

export class ControllerSessionTabSearchCharts {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _stored: IChartRequest[] = [];
    private _subscriptions: { [key: string]: Toolkit.Subscription } = {};
    private _subjects: ISubjects = {
        onChartsUpdated: new Subject<IChartRequest[]>(),
        onExtractingStarted: new Subject<void>(),
        onExtractingFinished: new Subject<void>(),
        onChartsResultsUpdated: new Subject<IPCMessages.TChartResults>(),
    };
    private _activeRequestId: string | undefined;
    private _data: IPCMessages.TChartResults = {};

    constructor(params: IControllerSessionStreamCharts) {
        this._guid = params.guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchCharts: ${params.guid}`);
        this._subscriptions.ChartResultsUpdated = ServiceElectronIpc.subscribe(IPCMessages.ChartResultsUpdated, this._ipc_ChartResultsUpdated.bind(this));
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((prop: string) => {
                this._subscriptions[prop].unsubscribe();
            });
            OutputParsersService.unsetChartsResults(this._guid);
            this.cancel().catch((error: Error) => {
                this._logger.error(`Fail to cancel a task of chart data extracting due error: ${error.message}`);
            }).finally(resolve);
        });
    }

    public getGuid(): string {
        return this._guid;
    }

    public getObservable(): {
        onChartsUpdated: Observable<IChartRequest[]>,
        onExtractingStarted: Observable<void>,
        onExtractingFinished: Observable<void>,
        onChartsResultsUpdated: Observable<IPCMessages.TChartResults>,
    } {
        return {
            onChartsUpdated: this._subjects.onChartsUpdated.asObservable(),
            onExtractingStarted: this._subjects.onExtractingStarted.asObservable(),
            onExtractingFinished: this._subjects.onExtractingFinished.asObservable(),
            onChartsResultsUpdated: this._subjects.onChartsResultsUpdated.asObservable(),
        };
    }

    public extract(options: IChartsOptions): Promise<IPCMessages.TChartResults> {
        return new Promise((resolve, reject) => {
            this.cancel().then(() => {
                if (options.requests.length === 0) {
                    this._data = {};
                    resolve({});
                    return this._subjects.onChartsResultsUpdated.next({});
                }
                this._extract(options).then((res: IPCMessages.TChartResults) => {
                    this._data = res;
                    resolve(res);
                }).catch((err: Error) => {
                    this._logger.error(`Fail to extract charts data due error: ${err.message}. Results will be dropped.`);
                    this._data = {};
                    reject(err);
                }).finally(() => {
                    this._subjects.onChartsResultsUpdated.next(this._data);
                });
            }).catch((cancelErr: Error) => {
                this._logger.error(`Fail to cancel current chart's data extracting operation due error: ${cancelErr.message}. Results will be dropped.`);
                reject(cancelErr);
            });
        });
    }

    public cancel(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._activeRequestId === undefined) {
                return resolve();
            }
            ServiceElectronIpc.request(new IPCMessages.ChartRequestCancelRequest({
                streamId: this._guid,
                requestId: this._activeRequestId,
            }), IPCMessages.ChartRequestCancelResponse).then((results: IPCMessages.ChartRequestCancelResponse) => {
                this._activeRequestId = undefined;
                if (results.error !== undefined) {
                    this._logger.error(`Chart data extractinng request id ${results.requestId} fail to cancel with error: ${results.error}`);
                    return reject(new Error(results.error));
                }
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public isChartStored(request: string): boolean {
        let result: boolean = false;
        this._stored.forEach((stored: IChartRequest) => {
            if (request === stored.reg.source) {
                result = true;
            }
        });
        return result;
    }

    public addStored(request: string): Error | undefined {
        if (this.isChartStored(request)) {
            return new Error(`Request "${request}" already exist`);
        }
        if (!Toolkit.regTools.isRegStrValid(request)) {
            return new Error(`Not valid regexp "${request}"`);
        }
        const errorMsg: string | undefined = this.isChartRegExpValid(request);
        if (errorMsg !== undefined) {
            return new Error(errorMsg);
        }
        const controller: AChart | undefined = getController(EChartType.stepped);
        if (controller === undefined) {
            return new Error(`Fail to find controller for chart "${EChartType.stepped}"`);
        }
        this._stored.push({
            reg: Toolkit.regTools.createFromStr(request) as RegExp,
            color: ColorScheme.scheme_color_0,
            type: EChartType.stepped,
            active: true,
            options: controller.getDefaultsOptions(),
        });
        this._subjects.onChartsUpdated.next(this._stored);
        this._refresh();
        return undefined;
    }

    public insertStored(requests: IChartRequest[]) {
        this._stored.push(...requests);
        this._subjects.onChartsUpdated.next(this._stored);
        this._refresh();
    }

    public removeStored(request: string) {
        this._stored = this._stored.filter((stored: IChartRequest) => {
            return request !== stored.reg.source;
        });
        this._subjects.onChartsUpdated.next(this._stored);
        this._refresh();
    }

    public removeAllStored() {
        this._stored = [];
        this._data = {};
        this._subjects.onChartsUpdated.next([]);
        this._subjects.onChartsResultsUpdated.next({});
    }

    public updateStored(request: string, updated: { reguest?: string, color?: string, type?: EChartType, active?: boolean, options?: IOptionsObj }) {
        let isUpdateRequired: boolean = false;
        this._stored = this._stored.map((stored: IChartRequest) => {
            if (request === stored.reg.source) {
                const prev = Object.assign({}, stored);
                if (updated.reguest !== undefined && stored.reg.source !== updated.reguest) {
                    isUpdateRequired = true;
                }
                if (updated.active !== undefined && stored.active !== updated.active) {
                    isUpdateRequired = true;
                }
                stored.reg = updated.reguest === undefined ? stored.reg : Toolkit.regTools.createFromStr(updated.reguest) as RegExp;
                stored.color = updated.color === undefined ? stored.color : updated.color;
                stored.type = updated.type === undefined ? stored.type : updated.type;
                stored.active = updated.active === undefined ? stored.active : updated.active;
                stored.options = updated.options === undefined ? stored.options : updated.options;
                if (prev.type !== stored.type) {
                    const controller: AChart = getController(stored.type);
                    if (controller === undefined) {
                        stored.options = {};
                    } else {
                        stored.options = controller.getDefaultsOptions(stored.options);
                    }
                }
            }
            return stored;
        });
        this._updateParsers();
        this._subjects.onChartsUpdated.next(this.getStored());
        if (!isUpdateRequired) {
            return;
        }
        this._refresh();
    }

    public overwriteStored(requests: IChartRequest[]) {
        this._stored = requests.map((filter: IChartRequest) => {
            return Object.assign({}, filter);
        });
        this._subjects.onChartsUpdated.next(this.getStored());
        this._refresh();
    }

    public getStored(): IChartRequest[] {
        return this._stored.map((filter: IChartRequest) => {
            return Object.assign({}, filter);
        });
    }

    public getCharts(): IChartRequest[] {
        return this._stored;
    }

    public getChartsData(): IPCMessages.TChartResults {
        return this._data;
    }

    public getSubjects(): ISubjects {
        return this._subjects;
    }

    public getChartColor(source: string): string | undefined {
        let color: string | undefined;
        this._stored.forEach((filter: IChartRequest) => {
            if (color !== undefined) {
                return;
            }
            if (filter.reg.source === source) {
                color = filter.color;
            }
        });
        return color;
    }

    public getChartOptions(source: string): IOptionsObj {
        let options: IOptionsObj | undefined;
        this._stored.forEach((filter: IChartRequest) => {
            if (options !== undefined) {
                return;
            }
            if (filter.reg.source === source) {
                options = filter.options;
            }
        });
        return options === undefined ? { } : options;
    }

    public getChartType(source: string, defaults: EChartType.smooth | undefined): EChartType {
        let chartType: EChartType | undefined;
        this._stored.forEach((filter: IChartRequest) => {
            if (chartType !== undefined) {
                return;
            }
            if (filter.reg.source === source) {
                chartType = filter.type;
            }
        });
        if (chartType === undefined) {
            chartType = defaults;
        }
        return chartType;
    }

    public getActiveCharts(): IChartRequest[] {
        return this._stored.filter((chart: IChartRequest) => {
            return chart.active;
        });
    }

    public isChartRegExpValid(regAsStr: string): string | undefined {
        // Check for groups
        if (regAsStr.search(/\(|\)/gi) === -1) {
            return `Regular expression should have at least one group`;
        }
        return undefined;
    }

    private _extract(options: IChartsOptions): Promise<IPCMessages.TChartResults> {
        return new Promise((resolve, reject) => {
            if (this._activeRequestId !== undefined) {
                return reject(new Error(`Fail to start extracting chart data, because previous request isn't finished`));
            }
            this._subjects.onExtractingStarted.next();
            // Store request Id
            this._activeRequestId = options.requestId;
            // Start search
            ServiceElectronIpc.request(new IPCMessages.ChartRequest({
                requests: options.requests,
                streamId: this._guid,
                requestId: options.requestId,
            }), IPCMessages.ChartRequestResults).then((results: IPCMessages.ChartRequestResults) => {
                this._logger.env(`Chart data extracting request ${results.requestId} was finished in ${((results.duration) / 1000).toFixed(2)}s.`);
                if (results.error !== undefined) {
                    // Some error during processing search request
                    this._logger.error(`Chart request id ${results.requestId} was finished with error: ${results.error}`);
                    return reject(new Error(results.error));
                }
                resolve(results.results);
            }).catch((error: Error) => {
                this._logger.error(`Fail to extract chart data due error: ${error.message}`);
                reject(error);
            }).finally(() => {
                this._activeRequestId = undefined;
                this._subjects.onExtractingFinished.next();
            });
        });
    }

    private _refresh() {
        this.extract({ requestId: Toolkit.guid(), requests: this.getActiveCharts().map((req: IChartRequest) => {
            return {
                source: req.reg.source,
                flags: req.reg.flags,
                groups: true,
            };
        })}).finally(() => {
            this._updateParsers();
        }).catch((error: Error) => {
            this._logger.error(`Fail to refresh charts data due error: ${error.message}`);
        });
    }

    private _updateParsers() {
        OutputParsersService.setCharts(this.getGuid(), this._stored.filter((chart: IChartRequest) => {
            return chart.active;
        }).map((chart: IChartRequest) => {
            return { reg: chart.reg, color: chart.color, background: undefined };
        }));
        OutputParsersService.updateRowsView();
    }

    private _ipc_ChartResultsUpdated(message: IPCMessages.ChartResultsUpdated) {
        if (message.streamId !== this._guid) {
            return;
        }
        Object.keys(message.results).forEach((chart: string) => {
            if (this._data[chart] === undefined) {
                this._data[chart] = [];
            }
            this._data[chart].push(...message.results[chart]);
        });
        this._subjects.onChartsResultsUpdated.next(this._data);
    }
}
