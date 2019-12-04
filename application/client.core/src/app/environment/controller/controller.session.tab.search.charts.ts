import { Observable, Subject, Subscription } from 'rxjs';
import { ControllerSessionTabStreamOutput } from './controller.session.tab.stream.output';
import { ControllerSessionScope } from './controller.session.tab.scope';
import * as Toolkit from 'chipmunk.client.toolkit';
import ServiceElectronIpc, { IPCMessages } from '../services/service.electron.ipc';
import * as ColorScheme from '../theme/colors';

export interface IControllerSessionStreamCharts {
    guid: string;
    stream: ControllerSessionTabStreamOutput;
    transports: string[];
    scope: ControllerSessionScope;
}

export enum EChartType {
    scatter = 'scatter',
}

export interface IChartRequest {
    reg: RegExp;
    color: string;
    type: EChartType;
    active: boolean;
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
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
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
        const errorMsg: string | undefined = this._isChartRegExpValid(request);
        if (errorMsg !== undefined) {
            return new Error(errorMsg);
        }
        this._stored.push({
            reg: Toolkit.regTools.createFromStr(request) as RegExp,
            color: ColorScheme.scheme_color_0,
            type: EChartType.scatter,
            active: true,
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
        this._subjects.onChartsUpdated.next([]);
    }

    public updateStored(request: string, updated: { reguest?: string, color?: string, type?: EChartType, active?: boolean }) {
        let isUpdateRequired: boolean = false;
        this._stored = this._stored.map((stored: IChartRequest) => {
            if (request === stored.reg.source) {
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
            }
            return stored;
        });
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

    public getActiveCharts(): IChartRequest[] {
        return this._stored.filter((chart: IChartRequest) => {
            return chart.active;
        });
    }

    private _isChartRegExpValid(regAsStr: string): string | undefined {
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
        })}).catch((error: Error) => {
            this._logger.error(`Fail to refresh charts data due error: ${error.message}`);
        });
    }
}
