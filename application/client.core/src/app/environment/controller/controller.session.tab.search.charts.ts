import { Observable, Subject, Subscription } from 'rxjs';
import { ControllerSessionTabStreamOutput } from './controller.session.tab.stream.output';
import { ControllerSessionScope } from './controller.session.tab.scope';
import * as Toolkit from 'chipmunk.client.toolkit';
import ServiceElectronIpc, { IPCMessages } from '../services/service.electron.ipc';
import * as ColorScheme from '../theme/colors';
import { getController, AChart, EChartType, IOptionsObj } from '../components/views/chart/charts/charts';
import OutputParsersService from '../services/standalone/service.output.parsers';
import {
    ChartRequest,
    IChartFlags,
    IChartDesc,
    IChartsChangeEvent,
    IChartsStorageUpdated,
    IChartDescOptional,
    IChartDescUpdating,
    ChartsStorage,
} from './controller.session.tab.search.charts.storage';

export interface IControllerSessionStreamCharts {
    guid: string;
    stream: ControllerSessionTabStreamOutput;
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
    onChartsUpdated: Subject<ChartRequest[]>;
    onExtractingStarted: Subject<void>;
    onExtractingFinished: Subject<void>;
    onChartsResultsUpdated: Subject<IPCMessages.TChartResults>;
}

export class ControllerSessionTabSearchCharts {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _storage: ChartsStorage;
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _subjects: ISubjects = {
        onChartsUpdated: new Subject<ChartRequest[]>(),
        onExtractingStarted: new Subject<void>(),
        onExtractingFinished: new Subject<void>(),
        onChartsResultsUpdated: new Subject<IPCMessages.TChartResults>(),
    };
    private _activeRequestId: string | undefined;
    private _data: IPCMessages.TChartResults = {};

    constructor(params: IControllerSessionStreamCharts) {
        this._guid = params.guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchCharts: ${params.guid}`);
        this._storage = new ChartsStorage(params.guid);
        this._subscriptions.ChartResultsUpdated = ServiceElectronIpc.subscribe(IPCMessages.ChartResultsUpdated, this._ipc_ChartResultsUpdated.bind(this));
        this._subscriptions.onStorageUpdated = this._storage.getObservable().updated.subscribe(this._onStorageUpdated.bind(this));
        this._subscriptions.onStorageChanged = this._storage.getObservable().changed.subscribe(this._onStorageChanged.bind(this));
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
        onChartsUpdated: Observable<ChartRequest[]>,
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

    public getStorage(): ChartsStorage {
        return this._storage;
    }

    public getChartsData(): IPCMessages.TChartResults {
        return this._data;
    }

    public getSubjects(): ISubjects {
        return this._subjects;
    }

    private _onStorageUpdated(event: IChartsStorageUpdated) {
        this._refresh();
    }

    private _onStorageChanged(request: IChartsChangeEvent) {
        if (request.reapply) {
            this._refresh();
        } else {
            this._updateRowsViews();
        }
    }

    private _updateRowsViews() {
        OutputParsersService.setCharts(this.getGuid(), this._storage.getActive().map((chart: ChartRequest) => {
            return { reg: chart.asRegExp(), color: chart.getColor(), background: undefined };
        }));
        OutputParsersService.updateRowsView();
        this._subjects.onChartsUpdated.next(this._storage.getActive());
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
        this.extract({ requestId: Toolkit.guid(), requests: this._storage.getActive().map((chart: ChartRequest) => {
            return {
                source: chart.asRegExp().source,
                flags: chart.asRegExp().flags,
                groups: true,
            };
        })}).finally(() => {
            this._updateRowsViews();
        }).catch((error: Error) => {
            this._logger.error(`Fail to refresh charts data due error: ${error.message}`);
        });
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
