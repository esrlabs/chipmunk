import * as Toolkit from 'chipmunk.client.toolkit';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import { ControllerSessionTab, IStreamState } from '../../../controller/controller.session.tab';
import { IMapState, IMapPoint } from '../../../controller/controller.session.tab.map';
import { Observable, Subscription, Subject } from 'rxjs';
import * as ColorScheme from '../../../theme/colors';
import { IPCMessages } from '../../../services/service.electron.ipc';

export interface IRange {
    begin: number;
    end: number;
}

export class ServiceData {

    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _sessionController: ControllerSessionTab | undefined;
    private _stream: IStreamState | undefined;
    private _matches: IMapState | undefined;
    private _max: number | undefined;
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

    public getDatasets(width: number, range?: IRange, noColors: boolean = false): Array<{ [key: string]: any }> {
        this._max = undefined;
        if (this._stream === undefined || this._matches === undefined) {
            return [];
        }
        if (this._stream.count === 0 || this._matches.points.length === 0) {
            return [];
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
        this._max = max;
        return datasets;
    }

    /*
    public getDatasets(width: number, range?: IRange, noColors: boolean = false): Array<{ [key: string]: any }> {
        this._max = undefined;
        if (this._stream === undefined || this._matches === undefined) {
            return [];
        }
        if (this._stream.count === 0 || this._matches.points.length === 0) {
            return [];
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
               data: results[filter],
            };
            datasets.push(dataset);
        });
        this._max = max;
        return datasets;
    }
    */

    public getChartsDatasets(width: number, range?: IRange, noColors: boolean = false): Array<{ [key: string]: any }> {
        if (this._stream === undefined || this._charts === undefined) {
            return [];
        }
        if (this._stream.count === 0 || Object.keys(this._charts).length === 0) {
            return [];
        }
        const results: any = {};
        if (range === undefined) {
            range = {
                begin: 0,
                end: this._stream.count,
            };
        }
        Object.keys(this._charts).forEach((reg: string) => {
            const matches: IPCMessages.IChartMatch[] = this._charts[reg];
            const border: { left: number | undefined, right: number | undefined } = { left: -1, right: undefined };
            let prev: number | undefined;
            matches.forEach((point: IPCMessages.IChartMatch) => {
                if (!(point.value instanceof Array) || point.value.length === 0) {
                    return;
                }
                const value: number = parseInt(point.value[0], 10);
                if (isNaN(value) || !isFinite(value)) {
                    return;
                }
                if (point.row < range.begin) {
                    border.left = value;
                    return;
                }
                if (point.row > range.end) {
                    if (border.right === undefined) {
                        border.right = value;
                    }
                    // TODO: here we can jump out
                    return;
                }
                if (results[reg] === undefined) {
                    results[reg] = [];
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
            if (results[reg] !== undefined && results[reg].length > 0) {
                // console.log(border.left);
                if (border.left !== -1 && range.begin <= results[reg][0].x) {
                    results[reg].unshift(...[
                        {
                            x: range.begin,
                            y: border.left,
                        },
                        {
                            x: results[reg][0].x,
                            y: border.left,
                        },
                    ]);
                }
                if (border.right !== undefined && range.end > results[reg][results[reg].length - 1].x) {
                    results[reg].push(...[
                        {
                            x: results[reg][results[reg].length - 1].x,
                            y: border.right,
                        },
                        {
                            x: range.end,
                            y: border.right,
                        }
                    ]);
                }
            }
        });
        const datasets = [];
        Object.keys(results).forEach((filter: string) => {
            const color: string | undefined = this._sessionController.getSessionSearch().getFiltersAPI().getRequestColor(filter);
            const dataset = {
                label: filter,
                borderColor: color === undefined ? ColorScheme.scheme_search_match : color,
                data: results[filter],
                borderWidth: 1,
                pointRadius: 5,
                pointHoverRadius: 5,
                fill: false,
                tension: 0,
                showLine: true
            };
            datasets.push(dataset);
        });
        return datasets;
    }

    public getMaxForLastRange(): number | undefined {
        if (this._stream === undefined) {
            return undefined;
        }
        if (this._matches === undefined) {
            return undefined;
        }
        return this._max;
    }

    public getStreamSize(): number | undefined {
        if (this._stream === undefined) {
            return undefined;
        }
        return this._stream.count;
    }

    public hasData(): boolean {
        if (this._stream === undefined) {
            return false;
        }
        if (this._matches === undefined) {
            return false;
        }
        return this._stream.count === 0 ? false : this._matches.points.length !== 0;
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
        this._sessionSubscriptions.onChartsResultsUpdated = controller.getSessionSearch().getChartsAPI().getObservable().onChartsResultsUpdated.subscribe(this._onChartsResultsUpdated.bind(this));
        // Get default data
        this._stream = controller.getSessionStream().getOutputStream().getState();
        this._matches = controller.getStreamMap().getState();
        this._charts = controller.getSessionSearch().getChartsAPI().getChartsData();
        this._subjects.onData.next();
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

    private _onChartsResultsUpdated(charts: IPCMessages.TChartResults) {
        this._charts = charts;
        this._subjects.onCharts.next();
        console.log(charts);
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
