import { Observable, Subject, Subscription } from 'rxjs';
import { ControllerSessionTabStreamOutput } from '../../../output/controller.session.tab.stream.output';
import { ControllerSessionScope } from '../../../scope/controller.session.tab.scope';
import { Session } from '../../../../session';
import { IPCMessages as IPC } from '../../../../../../services/service.electron.ipc';
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
import { ChartData, IChartData, IChartMatch } from './controller.session.tab.search.charts.data';

import ServiceElectronIpc from '../../../../../../services/service.electron.ipc';
import OutputParsersService from '../../../../../../services/standalone/service.output.parsers';
import EventsSessionService from '../../../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

export { ChartData, IChartData, IChartMatch };

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
    filters: IPC.IFilter[];
}

export interface ISubjects {
    onChartsUpdated: Subject<ChartRequest[]>;
    onExtractingStarted: Subject<void>;
    onExtractingFinished: Subject<void>;
    onChartsResultsUpdated: Subject<IChartData>;
    onChartSelected: Subject<ChartRequest | undefined>;
    onExport: Subject<void>;
}

export class ControllerSessionTabSearchCharts
    extends Importable<IChartDescOptional[]>
    implements Dependency {

    private readonly _logger: Toolkit.Logger;
    private readonly _guid: string;
    private readonly _storage: ChartsStorage;
    private readonly _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private readonly _subjects: ISubjects = {
        onChartsUpdated: new Subject<ChartRequest[]>(),
        onExtractingStarted: new Subject<void>(),
        onExtractingFinished: new Subject<void>(),
        onChartsResultsUpdated: new Subject<IChartData>(),
        onChartSelected: new Subject<ChartRequest | undefined>(),
        onExport: new Subject<void>(),
    };
    private readonly _data: ChartData = new ChartData();
    private _selected: string | undefined;
    private _accessor: {
        session: SessionGetter,
        search: SearchSessionGetter,
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
            this._subscriptions.ChartStateUpdated = ServiceElectronIpc.subscribe(
                IPC.ChartStateUpdated,
                this._ipc_ChartStateUpdated.bind(this),
            );
            this._subscriptions.onStorageUpdated = this._storage
                .getObservable()
                .updated.subscribe(this._onStorageUpdated.bind(this));
            this._subscriptions.onStorageChanged = this._storage
                .getObservable()
                .changed.subscribe(this._onStorageChanged.bind(this));
            this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
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
            this.tracking().stop().catch((error: Error) => {
                this._logger.error(
                    `Fail to cancel a task of chart data extracting due error: ${error.message}`,
                );
            }).finally(resolve);
            // this.cancel(undefined)
            //     .catch((error: Error) => {
            //         this._logger.error(
            //             `Fail to cancel a task of chart data extracting due error: ${error.message}`,
            //         );
            //     })
            //     .finally(resolve);
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
        onChartsResultsUpdated: Observable<IChartData>;
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
        return this._storage.getBySource(this._selected);
    }

    public getStorage(): ChartsStorage {
        return this._storage;
    }

    public getChartsData(): IChartData {
        return this._data.get();
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

    public tracking(): {
        start(): Promise<void>,
        stop(): Promise<void>,
        assign(): Promise<void>,
    } {
        const self = this;
        return {
            start(): Promise<void> {
                return new Promise((resolve, reject) => {
                    ServiceElectronIpc.request(
                        new IPC.ChartTrackingStartRequest({
                            session: self._guid,
                        }),
                        IPC.ChartTrackingStartResponse,
                    ).then((response: IPC.ChartTrackingStartResponse) => {
                        if (typeof response.error === 'string' && response.error.trim().length > 0) {
                            return reject(new Error(response.error));
                        }
                        resolve();
                    }).catch(reject);
                });
            },
            stop(): Promise<void> {
                return new Promise((resolve, reject) => {
                    ServiceElectronIpc.request(
                        new IPC.ChartTrackingStopRequest({
                            session: self._guid,
                        }),
                        IPC.ChartTrackingStopResponse,
                    ).then((response: IPC.ChartTrackingStopResponse) => {
                        if (typeof response.error === 'string' && response.error.trim().length > 0) {
                            return reject(new Error(response.error));
                        }
                        resolve();
                    }).catch(reject);
                });
            },
            assign(): Promise<void> {
                return new Promise((resolve, reject) => {
                    ServiceElectronIpc.request(
                        new IPC.ChartTrackingAssignRequest({
                            session: self._guid,
                            filters: self._storage.getActive().map((chart: ChartRequest) => chart.asFilter()),
                        }),
                        IPC.ChartTrackingAssignResponse,
                    ).then((response: IPC.ChartTrackingAssignResponse) => {
                        if (typeof response.error === 'string' && response.error.trim().length > 0) {
                            return reject(new Error(response.error));
                        }
                        resolve();
                    }).catch(reject);
                });
            }
        };
    }

    private _onStorageUpdated(event: IChartsStorageUpdated) {
        this.tracking().assign();
    }

    private _onStorageChanged(event: IChartUpdateEvent) {
        if (event.updated.state || event.updated.filter || event.updated.type) {
            this.tracking().assign();
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
/*
export interface IChartMatch {
    row: number;
    value: string[] | undefined;
}

export interface IChartData {
    [source: string]: IChartMatch[];
}

*/
    private _ipc_ChartStateUpdated(message: IPC.ChartStateUpdated) {
        if (message.streamId !== this._guid) {
            return;
        }
        this._data.from(message.state);
        this._subjects.onChartsResultsUpdated.next(this._data.get());
    }
}
