import * as Toolkit from 'chipmunk.client.toolkit';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import { ControllerSessionTab, IStreamState } from '../../../controller/controller.session.tab';
import { IMapState, IMapPoint } from '../../../controller/controller.session.tab.map';
import { Observable, Subscription, Subject } from 'rxjs';
import * as ColorScheme from '../../../theme/colors';
import ChartsControllers, { AChart } from './charts/charts';
import { IPCMessages } from '../../../services/service.electron.ipc';
import { EChartType } from './charts/charts';

export interface IRange {
    begin: number;
    end: number;
}

export interface IResults {
    dataset: Array<{ [key: string]: any }>;
    max: number | undefined;
    min: number | undefined;
}

export class ServiceData {

    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _sessionController: ControllerSessionTab | undefined;
    private _stream: IStreamState | undefined;
    private _matches: IMapState | undefined;
    private _charts: IPCMessages.TChartResults = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger(`Charts ServiceData`);
    private _cache: {
        data: { [reg: string]: number[] },
        hash: string,
    } = {
        data: {},
        hash: '',
    };
    private _subjects: {
        onData: Subject<void>,
        onCharts: Subject<IPCMessages.TChartResults>
    } = {
        onData: new Subject<void>(),
        onCharts: new Subject<IPCMessages.TChartResults>(),
    };

    constructor() {
        this._init();
        this._subscriptions.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._stream = undefined;
        this._matches = undefined;
    }

    public getObservable(): {
        onData: Observable<void>,
        onCharts: Observable<IPCMessages.TChartResults>
    } {
        return {
            onData: this._subjects.onData.asObservable(),
            onCharts: this._subjects.onCharts.asObservable(),
        };
    }

    public getLabes(width: number, range?: IRange): string[] {
        if (this._stream === undefined || this._matches === undefined) {
            return [];
        }
        if (this._stream.count === 0 || this._matches.points.length === 0) {
            return [];
        }
        const countInRange: number = range === undefined ? this._stream.count : (range.end - range.begin);
        let rate: number = width / countInRange;
        if (isNaN(rate) || !isFinite(rate)) {
            return [];
        }
        if (rate > 1) {
            rate = 1;
            width = countInRange;
        }
        const offset: number = range === undefined ? 0 : range.begin;
        const labels: string[] = (new Array(width)).fill('').map((value: string, i: number) => {
            const left: number = Math.round(i / rate) + offset;
            const right: number = Math.round((i + 1) / rate) + offset;
            return left !== (right - 1) ? ('' + left + ' - ' + right) : (left + '');
        });
        return labels;
    }

    public getDatasets(width: number, range?: IRange): IResults {
        if (this._stream === undefined || this._matches === undefined) {
            return { dataset: [], max: undefined, min: undefined };
        }
        if (this._stream.count === 0 || this._matches.points.length === 0) {
            return { dataset: [], max: undefined, min: undefined };
        }
        const results: any = {};
        const countInRange: number = range === undefined ? this._stream.count : (range.end - range.begin);
        let rate: number = width / countInRange;
        const commonWidth: number = Math.floor(this._stream.count / (countInRange / width));
        const maxes: number[] = (new Array(commonWidth)).fill(0);
        if (rate >= 1) {
            rate = 1;
            width = countInRange;
        }
        let max: number = -1;
        if (range === undefined) {
            range = {
                begin: 0,
                end: this._stream.count,
            };
        }
        this._matches.points.forEach((point: IMapPoint) => {
            if (!(point.regs instanceof Array)) {
                return;
            }
            let commonPosition: number = Math.floor(point.position * rate);
            if (commonPosition > commonWidth - 1) {
                commonPosition = commonWidth - 1;
            }
            maxes[commonPosition] += point.regs.length;
            if (maxes[commonPosition] > max) {
                max = maxes[commonPosition];
            }
            if (point.position < range.begin) {
                return;
            }
            if (point.position > range.end) {
                return;
            }
            point.regs.forEach((reg: string) => {
                let offsetedPosition: number = Math.floor((point.position - range.begin) * rate);
                if (results[reg] === undefined) {
                    results[reg] = (new Array(Math.round(width))).fill(0);
                }
                if (offsetedPosition > width - 1) {
                    offsetedPosition = width - 1;
                }
                results[reg][offsetedPosition] += 1;
            });
        });
        const datasets = [];
        Object.keys(results).forEach((filter: string) => {
            const color: string | undefined = this._sessionController.getSessionSearch().getFiltersAPI().getRequestColor(filter);
            const dataset = {
                barPercentage: 1,
                categoryPercentage: 1,
                label: filter,
                backgroundColor: color === undefined ? ColorScheme.scheme_search_match : color,
                showLine: false,
                data: results[filter],
            };
            datasets.push(dataset);
        });
        return { dataset: datasets, max: max, min: undefined };
    }

    public getChartsDatasets(width: number, range?: IRange, preview: boolean = false ): IResults {
        if (this._stream === undefined || this._charts === undefined) {
            return { dataset: [], max: undefined, min: undefined };
        }
        if (this._stream.count === 0 || Object.keys(this._charts).length === 0) {
            return { dataset: [], max: undefined, min: undefined };
        }
        const datasets = [];
        let max: number = -1;
        let min: number = Infinity;
        if (range === undefined) {
            range = {
                begin: 0,
                end: this._stream.count,
            };
        }
        Object.keys(this._charts).forEach((filter: string) => {
            const matches: IPCMessages.IChartMatch[] = this._charts[filter];
            const chartType: EChartType | undefined = this._sessionController.getSessionSearch().getChartsAPI().getChartType(filter, EChartType.smooth);
            const controller: AChart | undefined = ChartsControllers[chartType];
            if (controller === undefined) {
                this._logger.error(`Fail get controller for chart "${chartType}"`);
                return;
            }
            const ds = controller.getDataset(
                filter,
                matches,
                {
                    getColor: (source: string) => {
                        return this._sessionController.getSessionSearch().getChartsAPI().getChartColor(source);
                    },
                    getOptions: (source: string) => {
                        return this._sessionController.getSessionSearch().getChartsAPI().getChartOptions(source);
                    },
                    getLeftPoint: this._getLeftBorderChartDS.bind(this),
                    getRightPoint: this._getRightBorderChartDS.bind(this),
                },
                width,
                range,
                preview,
            );
            datasets.push(ds.dataset);
            if (ds.max > max) {
                max = ds.max;
            }
            if (ds.min < min) {
                min = ds.min;
            }
        });
        return { dataset: datasets, max: max, min: isFinite(min) ? min : undefined };
    }

    /*
        public getChartsDatasets(width: number, range?: IRange, preview: boolean = false ): IResults {
        if (this._stream === undefined || this._charts === undefined) {
            return { dataset: [], max: undefined };
        }
        if (this._stream.count === 0 || Object.keys(this._charts).length === 0) {
            return { dataset: [], max: undefined };
        }
        const results: any = {};
        let max: number = -1;
        if (range === undefined) {
            range = {
                begin: 0,
                end: this._stream.count,
            };
        }
        Object.keys(this._charts).forEach((reg: string) => {
            const matches: IPCMessages.IChartMatch[] = this._charts[reg];
            let prev: number | undefined;
            if (results[reg] === undefined) {
                results[reg] = [];
            }
            matches.forEach((point: IPCMessages.IChartMatch) => {
                if (!(point.value instanceof Array) || point.value.length === 0) {
                    return;
                }
                const value: number = parseInt(point.value[0], 10);
                if (isNaN(value) || !isFinite(value)) {
                    return;
                }
                if (max < value) {
                    max = value;
                }
                if (point.row < range.begin) {
                    return;
                }
                if (point.row > range.end) {
                    // TODO: here we can jump out
                    return;
                }
                if (prev !== undefined) {
                    results[reg].push({
                        x: point.row,
                        y: prev
                    });
                }
                results[reg].push({
                    x: point.row,
                    y: value
                });
                prev = value;
            });
            // Find borders first
            const left: number | undefined = this._getLeftBorderChartDS(reg, range.begin);
            const right: number | undefined = this._getRightBorderChartDS(reg, range.end);
            if (results[reg].length > 0) {
                left !== undefined && results[reg].unshift(...[
                    { x: range.begin,       y: left },
                    { x: results[reg][0].x, y: left },
                ]);
                right !== undefined && results[reg].push(...[
                    { x: results[reg][results[reg].length - 1].x, y: right },
                    { x: range.end,                               y: right }
                ]);
            } else {
                left !== undefined && results[reg].push(...[
                    { x: range.begin, y: left }
                ]);
                right !== undefined && results[reg].push(...[
                    { x: range.end, y: right }
                ]);
                if (results[reg].length !== 2) {
                    left !== undefined && results[reg].push(...[
                        { x: range.end, y: left }
                    ]);
                    right !== undefined && results[reg].unshift(...[
                        { x: range.begin, y: right }
                    ]);
                }
            }
        });
        const datasets = [];
        Object.keys(results).forEach((filter: string) => {
            const color: string | undefined = this._sessionController.getSessionSearch().getChartsAPI().getChartColor(filter);
            const dataset = {
                label: filter,
                borderColor: color === undefined ? ColorScheme.scheme_search_match : color,
                data: results[filter],
                borderWidth: 1,
                pointRadius: preview ? 1 : 2,
                pointHoverRadius: preview ? 1 : 2,
                fill: false,
                tension: 0,
                showLine: true,
            };
            datasets.push(dataset);
        });
        return { dataset: datasets, max: max };
    }
    */

    public getStreamSize(): number | undefined {
        if (this._stream === undefined) {
            return undefined;
        }
        return this._stream.count;
    }

    public hasData(): boolean {
        if (this._stream === undefined || this._stream.count === 0) {
            return false;
        }
        if (this._matches === undefined && this._charts === undefined) {
            return false;
        }
        if (this._matches !== undefined && this._matches.points.length === 0 && this._charts !== undefined && Object.keys(this._charts).length === 0) {
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

    private _init(controller?: ControllerSessionTab) {
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
        this._sessionSubscriptions.onSearchMapStateUpdate = controller.getStreamMap().getObservable().onStateUpdate.subscribe(this._onSearchMapStateUpdate.bind(this));
        this._sessionSubscriptions.onStreamStateUpdated = controller.getSessionStream().getOutputStream().getObservable().onStateUpdated.subscribe(this._onStreamStateUpdated.bind(this));
        this._sessionSubscriptions.onRequestsUpdated = controller.getSessionSearch().getFiltersAPI().getObservable().onRequestsUpdated.subscribe(this._onRequestsUpdated.bind(this));
        this._sessionSubscriptions.onChartsResultsUpdated = controller.getSessionSearch().getChartsAPI().getObservable().onChartsResultsUpdated.subscribe(this._onChartsResultsUpdated.bind(this));
        this._sessionSubscriptions.onChartsUpdated = controller.getSessionSearch().getChartsAPI().getObservable().onChartsUpdated.subscribe(this._onChartsUpdated.bind(this));
        // Get default data
        this._stream = controller.getSessionStream().getOutputStream().getState();
        this._matches = controller.getStreamMap().getState();
        this._charts = controller.getSessionSearch().getChartsAPI().getChartsData();
        this._subjects.onData.next();
        this._subjects.onCharts.next();
    }

    private _onSessionChange(controller: ControllerSessionTab) {
        if (controller === undefined) {
            return;
        }
        this._init(controller);
    }

    private _onSearchMapStateUpdate(state: IMapState) {
        this._matches = state;
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

    private _onChartsResultsUpdated(charts: IPCMessages.TChartResults) {
        this._charts = charts;
        this._subjects.onCharts.next();
    }

    private _onChartsUpdated() {
        // Some things like colors was changed. Trigger an update
        this._subjects.onCharts.next();
    }

    private _getLeftBorderChartDS(reg: string, begin: number): number | undefined {
        const matches: IPCMessages.IChartMatch[] | undefined = this._charts[reg];
        if (matches === undefined) {
            return undefined;
        }
        try {
            let prev: IPCMessages.IChartMatch | undefined;
            matches.forEach((match: IPCMessages.IChartMatch) => {
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
            return this._getValidNumberValue(matches[0].value[0]);
        } catch (target) {
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

    private _getRightBorderChartDS(reg: string, end: number, previous: boolean): number | undefined {
        const matches: IPCMessages.IChartMatch[] | undefined = this._charts[reg];
        if (matches === undefined || matches.length === 0) {
            return undefined;
        }
        try {
            let prev: IPCMessages.IChartMatch | undefined;
            matches.forEach((match: IPCMessages.IChartMatch) => {
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
            return this._getValidNumberValue(matches[matches.length - 1].value[0]);
        } catch (target) {
            if (typeof target === 'object' && target !== null && target.row && target.value) {
                return this._getValidNumberValue(target.value[0]);
            }
        }
        return undefined;
    }

    private _getValidNumberValue(val: string): number | undefined {
        const value: number = parseInt(val, 10);
        if (isNaN(value) || !isFinite(value)) {
            return undefined;
        }
        return value;
    }

    private _getHash(width: number): string | undefined {
        if (this._sessionController === undefined) {
            return undefined;
        }
        const hash: string = `${this._sessionController.getSessionSearch().getFiltersAPI().getActiveAsRegs().map((reg: RegExp) => {
            return reg.source;
        }).join('-')}${this._sessionController.getGuid()}-${width}`;
        return hash;
    }

}
