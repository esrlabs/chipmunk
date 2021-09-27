import { Observable, Subject, Subscription } from 'rxjs';
import { ControllerSessionTabStreamOutput } from '../../../output/controller.session.tab.stream.output';
import { ControllerSessionScope } from '../../../scope/controller.session.tab.scope';
import { Session } from '../../../../session';
import { IPC } from '../../../../../../services/service.electron.ipc';
import { EChartType } from '../../../../../../components/views/chart/charts/charts';
import { Importable } from '../../../importer/controller.session.importer.interface';
import {
    ChartRequest,
    IChartUpdateEvent,
    IChartsStorageUpdated,
    ChartsStorage,
    IChartDescOptional,
} from './controller.session.tab.search.charts.storage';
import { Dependency, SessionGetter, SearchSessionGetter } from '../search.dependency';

import ServiceElectronIpc from '../../../../../../services/service.electron.ipc';
import OutputParsersService from '../../../../../../services/standalone/service.output.parsers';
import EventsSessionService from '../../../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

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
    requests: IPC.IChartRegExpStr[];
}

export interface ISubjects {
    onChartsUpdated: Subject<ChartRequest[]>;
    onExtractingStarted: Subject<void>;
    onExtractingFinished: Subject<void>;
    onChartsResultsUpdated: Subject<IPC.TChartResults>;
    onChartSelected: Subject<ChartRequest | undefined>;
    onExport: Subject<void>;
}

export class ControllerSessionTabSearchCharts
    extends Importable<IChartDescOptional[]>
    implements Dependency
{
    private _logger: Toolkit.Logger;
    private _guid: string;
    private _storage: ChartsStorage;
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _subjects: ISubjects = {
        onChartsUpdated: new Subject<ChartRequest[]>(),
        onExtractingStarted: new Subject<void>(),
        onExtractingFinished: new Subject<void>(),
        onChartsResultsUpdated: new Subject<IPC.TChartResults>(),
        onChartSelected: new Subject<ChartRequest | undefined>(),
        onExport: new Subject<void>(),
    };
    private _data: IPC.TChartResults = {};
    private _selected: string | undefined;
    private _tasks: Map<string, Promise<IPC.TChartResults>> = new Map();
    private _accessor: {
        session: SessionGetter;
        search: SearchSessionGetter;
    };

    constructor(uuid: string, session: SessionGetter, search: SearchSessionGetter) {
        super();
        this._guid = uuid;
        this._accessor = {
            session,
            search,
        };
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchCharts: ${uuid}`);
        this._storage = new ChartsStorage(uuid, session);
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscriptions.ChartResultsUpdated = ServiceElectronIpc.subscribe(
                IPC.ChartResultsUpdated,
                this._ipc_ChartResultsUpdated.bind(this),
            );
            this._subscriptions.onStorageUpdated = this._storage
                .getObservable()
                .updated.subscribe(this._onStorageUpdated.bind(this));
            this._subscriptions.onStorageChanged = this._storage
                .getObservable()
                .changed.subscribe(this._onStorageChanged.bind(this));
            this._subscriptions.onSessionChange =
                EventsSessionService.getObservable().onSessionChange.subscribe(
                    this._onSessionChange.bind(this),
                );
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((prop: string) => {
                this._subscriptions[prop].unsubscribe();
            });
            OutputParsersService.unsetChartsResults(this._guid);
            this.cancel(undefined)
                .catch((error: Error) => {
                    this._logger.error(
                        `Fail to cancel a task of chart data extracting due error: ${error.message}`,
                    );
                })
                .finally(resolve);
        });
    }

    public getName(): string {
        return 'ControllerSessionTabSearchCharts';
    }

    public getGuid(): string {
        return this._guid;
    }

    public getObservable(): {
        onChartsUpdated: Observable<ChartRequest[]>;
        onExtractingStarted: Observable<void>;
        onExtractingFinished: Observable<void>;
        onChartsResultsUpdated: Observable<IPC.TChartResults>;
        onChartSelected: Observable<ChartRequest | undefined>;
    } {
        return {
            onChartsUpdated: this._subjects.onChartsUpdated.asObservable(),
            onExtractingStarted: this._subjects.onExtractingStarted.asObservable(),
            onExtractingFinished: this._subjects.onExtractingFinished.asObservable(),
            onChartsResultsUpdated: this._subjects.onChartsResultsUpdated.asObservable(),
            onChartSelected: this._subjects.onChartSelected.asObservable(),
        };
    }

    public selectBySource(source: string | undefined) {
        this._selected = source;
        if (source === undefined) {
            this._subjects.onChartSelected.next(undefined);
        } else {
            this._subjects.onChartSelected.next(this._storage.getBySource(source));
        }
    }

    public getSelectedChart(): ChartRequest | undefined {
        return this._selected === undefined ? undefined : this._storage.getBySource(this._selected);
    }

    public extract(options: IChartsOptions): Promise<IPC.TChartResults> {
        const task: Promise<IPC.TChartResults> = new Promise((resolve, reject) => {
            this.cancel(options.requestId)
                .then(() => {
                    if (options.requests.length === 0 || !this._tasks.has(options.requestId)) {
                        this._tasks.delete(options.requestId);
                        this._data = {};
                        this._subjects.onChartsResultsUpdated.next({});
                        resolve({});
                        return;
                    }
                    this._extract(options)
                        .then((res: IPC.TChartResults) => {
                            if (!this._tasks.has(options.requestId)) {
                                this._data = {};
                            } else {
                                this._data = res;
                            }
                            resolve(res);
                        })
                        .catch((err: Error) => {
                            this._logger.error(
                                `Fail to extract charts data due error: ${err.message}. Results will be dropped.`,
                            );
                            this._data = {};
                            reject(err);
                        })
                        .finally(() => {
                            this._subjects.onChartsResultsUpdated.next(this._data);
                        });
                })
                .catch((cancelErr: Error) => {
                    this._logger.error(
                        `Fail to cancel current chart's data extracting operation due error: ${cancelErr.message}. Results will be dropped.`,
                    );
                    reject(cancelErr);
                });
        });
        this._tasks.set(options.requestId, task);
        return task;
    }

    public cancel(exception: string | undefined): Promise<void> {
        return new Promise((resolve, reject) => {
            const ids: string[] = Array.from(this._tasks.keys()).filter((id: string) => {
                return id !== exception;
            });
            if (ids.length === 0) {
                // Nothing to cancel
                return resolve();
            }
            Promise.all(
                ids.map((requestId: string) => {
                    return ServiceElectronIpc.request<IPC.ChartRequestCancelResponse>(
                        new IPC.ChartRequestCancelRequest({
                            streamId: this._guid,
                            requestId: requestId,
                        }),
                        IPC.ChartRequestCancelResponse,
                    )
                        .then((results) => {
                            this._tasks.delete(requestId);
                            if (results.error !== undefined) {
                                this._logger.error(
                                    `Chart data extractinng request id ${results.requestId} fail to cancel with error: ${results.error}`,
                                );
                                return reject(new Error(results.error));
                            }
                            resolve();
                        })
                        .catch((error: Error) => {
                            this._tasks.delete(requestId);
                            reject(error);
                        });
                }),
            )
                .then(() => {
                    resolve();
                })
                .catch((remoteCancelErr: Error) => {
                    this._logger.error(
                        `Cancelation was failed due error: ${remoteCancelErr.message}`,
                    );
                    reject(remoteCancelErr);
                });
        });
    }

    public getStorage(): ChartsStorage {
        return this._storage;
    }

    public getChartsData(): IPC.TChartResults {
        return this._data;
    }

    public getSubjects(): ISubjects {
        return this._subjects;
    }

    public getExportObservable(): Observable<void> {
        return this._subjects.onExport.asObservable();
    }

    public getImporterUUID(): string {
        return 'charts';
    }

    public export(): Promise<IChartDescOptional[] | undefined> {
        return new Promise((resolve) => {
            if (this._storage.get().length === 0) {
                return resolve(undefined);
            }
            resolve(this._storage.getAsDesc());
        });
    }

    public import(filters: IChartDescOptional[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this._storage.clear();
            const err: Error | undefined = this._storage.add(filters);
            if (err instanceof Error) {
                reject(err);
            } else {
                resolve();
            }
        });
    }

    private _onStorageUpdated(event: IChartsStorageUpdated) {
        this._refresh();
    }

    private _onStorageChanged(event: IChartUpdateEvent) {
        if (event.updated.state || event.updated.request || event.updated.type) {
            this._refresh();
        } else {
            this._updateRowsViews();
        }
    }

    private _onSessionChange(controller: Session | undefined) {
        if (controller === undefined) {
            return;
        }
        if (controller.getGuid() === this._guid) {
            return;
        }
        this.selectBySource(undefined);
    }

    private _updateRowsViews() {
        OutputParsersService.setCharts(
            this.getGuid(),
            this._storage.getActive().map((chart: ChartRequest) => {
                return { reg: chart.asRegExp(), color: chart.getColor(), background: undefined };
            }),
        );
        OutputParsersService.updateRowsView();
        this._subjects.onChartsUpdated.next(this._storage.getActive());
    }

    private _extract(options: IChartsOptions): Promise<IPC.TChartResults> {
        return new Promise((resolve, reject) => {
            if (!this._tasks.has(options.requestId)) {
                // Task was removed
                return resolve({});
            }
            // Trigger start of extracting
            this._subjects.onExtractingStarted.next();
            // Start search
            ServiceElectronIpc.request<IPC.ChartRequestResults>(
                new IPC.ChartRequest({
                    requests: options.requests,
                    streamId: this._guid,
                    requestId: options.requestId,
                }),
                IPC.ChartRequestResults,
            )
                .then((results) => {
                    if (!this._tasks.has(options.requestId)) {
                        // Task was removed
                        return resolve({});
                    }
                    this._logger.env(
                        `Chart data extracting request ${results.requestId} was finished in ${(
                            results.duration / 1000
                        ).toFixed(2)}s.`,
                    );
                    if (results.error !== undefined) {
                        // Some error during processing search request
                        this._logger.error(
                            `Chart request id ${results.requestId} was finished with error: ${results.error}`,
                        );
                        return reject(new Error(results.error));
                    }
                    resolve(results.results);
                })
                .catch((error: Error) => {
                    this._logger.error(`Fail to extract chart data due error: ${error.message}`);
                    reject(error);
                })
                .finally(() => {
                    this._tasks.delete(options.requestId);
                    this._subjects.onExtractingFinished.next();
                });
        });
    }

    private _refresh() {
        this.extract({
            requestId: Toolkit.guid(),
            requests: this._storage.getActive().map((chart: ChartRequest) => {
                return {
                    source: chart.asRegExp().source,
                    flags: chart.asRegExp().flags,
                    groups: true,
                };
            }),
        })
            .finally(() => {
                this._updateRowsViews();
                this._subjects.onExport.next();
            })
            .catch((error: Error) => {
                this._logger.error(`Fail to refresh charts data due error: ${error.message}`);
            });
    }

    private _ipc_ChartResultsUpdated(message: IPC.ChartResultsUpdated) {
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
