import * as Toolkit from 'chipmunk.client.toolkit';
import { Session, IStreamState } from '../../../controller/session/session';
import { ChartRequest } from '../../../controller/session/dependencies/search/dependencies/charts/controller.session.tab.search.charts.request';
import { FilterRequest } from '../../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters.request';
import { IMapState } from '../../../controller/session/dependencies/map/controller.session.tab.map';
import { Observable, Subscription, Subject } from 'rxjs';
import { AChart } from './charts/charts';
import { IPC } from '../../../services/service.electron.ipc';
import { scheme_color_accent } from '../../../theme/colors';
import { ChartDataset } from 'chart.js';

import TabsSessionsService from '../../../services/service.sessions.tabs';
import ChartsControllers from './charts/charts';

export interface IRange {
    begin: number;
    end: number;
}

export interface IResults {
    dataset: Array<ChartDataset<'bar', number[]>>;
    max: number | undefined;
    min: number | undefined;
}

export enum EScaleType {
    single = 'single',
    common = 'common',
}

export interface IScaleState {
    yAxisIDs: string[];
    max: number[];
    min: number[];
    type: EScaleType;
    colors: Array<string | undefined>;
}

export interface IChartsResults {
    dataset: Array<ChartDataset<'bar', number[]>>;
    scale: IScaleState;
}

export class ServiceData {
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _sessionController: Session | undefined;
    private _stream: IStreamState | undefined;
    private _charts: IPC.TChartResults = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger(`Charts ServiceData`);
    private _scale: IScaleState = {
        min: [],
        max: [],
        type: EScaleType.common,
        yAxisIDs: [],
        colors: [],
    };
    private _subjects: {
        onData: Subject<void>;
        onCharts: Subject<IPC.TChartResults>;
        onChartsScaleType: Subject<EScaleType>;
    } = {
        onData: new Subject<void>(),
        onCharts: new Subject<IPC.TChartResults>(),
        onChartsScaleType: new Subject<EScaleType>(),
    };

    constructor() {
        this._init();
    }

    public destroy() {
        this._stream = undefined;
    }

    public getObservable(): {
        onData: Observable<void>;
        onCharts: Observable<IPC.TChartResults>;
        onChartsScaleType: Observable<EScaleType>;
    } {
        return {
            onData: this._subjects.onData.asObservable(),
            onCharts: this._subjects.onCharts.asObservable(),
            onChartsScaleType: this._subjects.onChartsScaleType.asObservable(),
        };
    }

    public getScaleType(): EScaleType {
        return this._scale.type;
    }

    public getScaleState(): IScaleState {
        return this._scale;
    }

    public getLabes(width: number, range?: IRange): string[] {
        if (this._stream === undefined) {
            return [];
        }
        if (this._stream.count === 0) {
            return [];
        }
        const countInRange: number =
            range === undefined ? this._stream.count : range.end - range.begin;
        let rate: number = width / countInRange;
        if (isNaN(rate) || !isFinite(rate)) {
            return [];
        }
        if (rate > 1) {
            rate = 1;
            width = countInRange;
        }
        const offset: number = range === undefined ? 0 : range.begin;
        const labels: string[] = new Array(width).fill('').map((value: string, i: number) => {
            const left: number = Math.round(i / rate) + offset;
            const right: number = Math.round((i + 1) / rate) + offset;
            return left !== right - 1 ? '' + left + ' - ' + right : left + '';
        });
        return labels;
    }

    public getDatasets(width: number, range?: IRange): Promise<IResults> {
        return new Promise((resolve, reject) => {
            if (this._sessionController === undefined) {
                return reject(new Error(this._logger.error(`Session controller isn't defined`)));
            }
            if (this._stream === undefined) {
                return resolve({ dataset: [], max: undefined, min: undefined });
            }
            if (this._stream.count === 0) {
                return resolve({ dataset: [], max: undefined, min: undefined });
            }
            if (range === undefined) {
                range = {
                    begin: 0,
                    end: this._stream.count,
                };
            }
            this._sessionController
                .getStreamMap()
                .getMatchesMap(width, range)
                .then((map) => {
                    const dss: any = {};
                    const indexes: number[] = Object.keys(map).map((k) =>
                        typeof k !== 'number' ? parseInt(k, 10) : k,
                    );
                    const count: number = indexes.length;
                    let max: number = -1;
                    indexes.forEach((key: number) => {
                        const matches: { [key: string]: number } = map[key];
                        Object.keys(matches).forEach((match: string) => {
                            if (dss[match] === undefined) {
                                dss[match] = new Array(Math.round(count)).fill(0);
                            }
                            dss[match][key] = matches[match];
                            if (matches[match] > max) {
                                max = matches[match];
                            }
                        });
                    });
                    const datasets: any[] = [];
                    Object.keys(dss).forEach((filter: string) => {
                        const smth: FilterRequest | ChartRequest | undefined =
                            this._getFilterOrChart(filter);
                        let color: string = scheme_color_accent;
                        if (smth !== undefined) {
                            color =
                                smth instanceof FilterRequest
                                    ? smth.getBackground()
                                    : smth.getColor();
                        }
                        const dataset = {
                            barPercentage: 1,
                            categoryPercentage: 1,
                            label: filter,
                            backgroundColor: color,
                            showLine: false,
                            data: dss[filter],
                        };
                        datasets.push(dataset);
                    });
                    resolve({ dataset: datasets, max: max, min: undefined });
                })
                .catch((err: Error) => {
                    reject(
                        new Error(
                            this._logger.warn(`Fail to get dataset due error: ${err.message}`),
                        ),
                    );
                });
        });
    }

    public getChartsDatasets(
        width: number,
        range?: IRange,
        preview: boolean = false,
    ): IChartsResults {
        if (this._stream === undefined || this._charts === undefined) {
            return {
                dataset: [],
                scale: {
                    max: [],
                    min: [],
                    yAxisIDs: [],
                    type: this._scale.type,
                    colors: [],
                },
            };
        }
        if (this._stream.count === 0 || Object.keys(this._charts).length === 0) {
            return {
                dataset: [],
                scale: {
                    max: [],
                    min: [],
                    yAxisIDs: [],
                    type: this._scale.type,
                    colors: [],
                },
            };
        }
        const datasets: any[] = [];
        const max: number[] = [];
        const min: number[] = [];
        const colors: Array<string | undefined> = [];
        const yAxisID: string[] = [];
        if (range === undefined) {
            range = {
                begin: 0,
                end: this._stream.count,
            };
        }
        Object.keys(this._charts).forEach((filter: string) => {
            const chart: ChartRequest | undefined = this._getChartBySource(filter);
            if (chart === undefined) {
                this._logger.error(`[datasets] Fail to find a chart with source "${filter}"`);
                return;
            }
            const matches: IPC.IChartMatch[] = this._charts[filter];
            const controller: AChart | undefined = ChartsControllers[chart.getType()];
            if (controller === undefined) {
                this._logger.error(`Fail get controller for chart "${chart.getType()}"`);
                return;
            }
            const ds = controller.getDataset(
                filter,
                matches,
                {
                    getColor: (source: string) => {
                        const _chart: ChartRequest | undefined = this._getChartBySource(source);
                        return _chart === undefined ? undefined : chart.getColor();
                    },
                    getOptions: (source: string) => {
                        const _chart: ChartRequest | undefined = this._getChartBySource(source);
                        return _chart === undefined ? undefined : chart.getOptions();
                    },
                    getLeftPoint: this._getLeftBorderChartDS.bind(this),
                    getRightPoint: this._getRightBorderChartDS.bind(this),
                },
                width,
                range as IRange,
                preview,
            );

            datasets.push(ds.dataset);
            max.push(ds.max);
            min.push(ds.min);
            colors.push(
                (() => {
                    const _chart: ChartRequest | undefined = this._getChartBySource(filter);
                    return _chart === undefined ? undefined : chart.getColor();
                })(),
            );
            yAxisID.push(ds.dataset.yAxisID);
        });
        this._scale = {
            min: min,
            max: max,
            yAxisIDs: yAxisID,
            type: this._scale.type,
            colors: colors,
        };
        return {
            dataset: datasets,
            scale: {
                max: max,
                min: min,
                yAxisIDs: yAxisID,
                type: this._scale.type,
                colors: colors,
            },
        };
    }

    public getStreamSize(): number | undefined {
        if (this._stream === undefined) {
            return undefined;
        }
        return this._stream.count;
    }

    public hasData(): boolean {
        if (this._sessionController === undefined) {
            this._logger.error(`Session controller isn't defined`);
            return false;
        }
        if (this._stream === undefined || this._stream.count === 0) {
            return false;
        }
        if (this._sessionController.getSessionSearch().getOutputStream().getRowsCount() > 0) {
            return true;
        }
        if (this._charts === undefined) {
            return false;
        }
        if (this._charts !== undefined && Object.keys(this._charts).length === 0) {
            return false;
        }
        return true;
    }

    public getSessionGuid(): string | undefined {
        if (this._sessionController === undefined) {
            return;
        }
        return this._sessionController.getGuid();
    }

    public setChartsScaleType(sType: EScaleType) {
        if (this._scale.type === sType) {
            return;
        }
        this._scale.type = sType;
        this._subjects.onChartsScaleType.next(sType);
    }

    private _getChartBySource(source: string): ChartRequest | undefined {
        if (this._sessionController === undefined) {
            return undefined;
        }
        return this._sessionController
            .getSessionSearch()
            .getChartsAPI()
            .getStorage()
            .getBySource(source);
    }

    private _getFilterBySource(source: string): FilterRequest | undefined {
        if (this._sessionController === undefined) {
            return undefined;
        }
        return this._sessionController
            .getSessionSearch()
            .getFiltersAPI()
            .getStorage()
            .getBySource(source);
    }

    private _getFilterOrChart(source: string): FilterRequest | ChartRequest | undefined {
        const chart: ChartRequest | undefined = this._getChartBySource(source);
        return chart === undefined ? this._getFilterBySource(source) : chart;
    }

    private _init(controller?: Session) {
        controller = controller === undefined ? TabsSessionsService.getActive() : controller;
        if (controller === undefined) {
            return;
        }
        // Store controller
        this._sessionController = controller;
        // Unbound from events of prev session
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].unsubscribe();
        });
        // Subscribe
        this._sessionSubscriptions.onSearchMapStateUpdate = controller
            .getStreamMap()
            .getObservable()
            .onStateUpdate.subscribe(this._onSearchMapStateUpdate.bind(this));
        this._sessionSubscriptions.onStreamStateUpdated = controller
            .getStreamOutput()
            .getObservable()
            .onStateUpdated.subscribe(this._onStreamStateUpdated.bind(this));
        this._sessionSubscriptions.onRequestsUpdated = controller
            .getSessionSearch()
            .getFiltersAPI()
            .getObservable()
            .updated.subscribe(this._onRequestsUpdated.bind(this));
        this._sessionSubscriptions.onSearchStateUpdated = controller
            .getSessionSearch()
            .getOutputStream()
            .getObservable()
            .onStateUpdated.subscribe(this._onSearchStateUpdated.bind(this));
        this._sessionSubscriptions.onRequestsUpdated = controller
            .getSessionSearch()
            .getFiltersAPI()
            .getStorage()
            .getObservable()
            .changed.subscribe(this._onRequestsUpdated.bind(this));
        this._sessionSubscriptions.onChartsResultsUpdated = controller
            .getSessionSearch()
            .getChartsAPI()
            .getObservable()
            .onChartsResultsUpdated.subscribe(this._onChartsResultsUpdated.bind(this));
        this._sessionSubscriptions.onChartsUpdated = controller
            .getSessionSearch()
            .getChartsAPI()
            .getObservable()
            .onChartsUpdated.subscribe(this._onChartsUpdated.bind(this));
        // Get default data
        this._stream = controller.getStreamOutput().getState();
        this._charts = controller.getSessionSearch().getChartsAPI().getChartsData();
        this._subjects.onData.next();
        this._subjects.onCharts.next({});
    }

    private _onSearchMapStateUpdate(state: IMapState) {
        this._subjects.onData.next();
    }

    private _onSearchStateUpdated() {
        this._subjects.onData.next();
    }

    private _onStreamStateUpdated(state: IStreamState) {
        this._stream = state;
        this._subjects.onData.next();
    }

    private _onRequestsUpdated() {
        // Some things like colors was changed. Trigger an update
        this._subjects.onData.next();
    }

    private _onChartsResultsUpdated(charts: IPC.TChartResults) {
        this._charts = charts;
        this._subjects.onCharts.next({});
    }

    private _onChartsUpdated(charts: ChartRequest[]) {
        // Some things like colors was changed. Trigger an update
        this._subjects.onCharts.next({});
    }

    private _getLeftBorderChartDS(reg: string, begin: number): number | undefined {
        const matches: IPC.IChartMatch[] | undefined = this._charts[reg];
        if (matches === undefined) {
            return undefined;
        }
        try {
            let prev: IPC.IChartMatch | undefined;
            matches.forEach((match: IPC.IChartMatch) => {
                if (match.row === begin) {
                    throw match;
                }
                if (match.row > begin) {
                    if (prev === undefined) {
                        throw match;
                    } else {
                        throw prev;
                    }
                }
                prev = match;
            });
            if (matches[0].value === undefined) {
                return undefined;
            } else {
                return this._getValidNumberValue(matches[0].value[0]);
            }
        } catch (target: any) {
            if (typeof target === 'object' && target !== null && target.row && target.value) {
                const value: number = parseInt(target.value[0], 10);
                if (isNaN(value) || !isFinite(value)) {
                    return;
                }
                return this._getValidNumberValue(target.value[0]);
            }
        }
        return undefined;
    }

    private _getRightBorderChartDS(
        reg: string,
        end: number,
        previous: boolean,
    ): number | undefined {
        const matches: IPC.IChartMatch[] | undefined = this._charts[reg];
        if (matches === undefined || matches.length === 0) {
            return undefined;
        }
        try {
            let prev: IPC.IChartMatch | undefined;
            matches.forEach((match: IPC.IChartMatch) => {
                if (match.row === end) {
                    throw match;
                }
                if (match.row > end) {
                    if (!previous) {
                        throw match;
                    }
                    if (prev === undefined) {
                        throw match;
                    } else {
                        throw prev;
                    }
                }
                prev = match;
            });
            if (matches[matches.length - 1].value === undefined) {
                return undefined;
            } else {
                return this._getValidNumberValue((matches[matches.length - 1].value as any)[0]);
            }
        } catch (target: any) {
            if (typeof target === 'object' && target !== null && target.row && target.value) {
                return this._getValidNumberValue(target.value[0]);
            }
        }
        return undefined;
    }

    private _getValidNumberValue(val: string): number | undefined {
        const value: number = parseFloat(val);
        if (isNaN(value) || !isFinite(value)) {
            return undefined;
        }
        return value;
    }
}
