import { Subscription, Subject, Observable } from 'rxjs';
import { IRange, EChartMode } from '../../../controller/controller.session.tab.timestamp';
import { scheme_color_0 } from '../../../theme/colors';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';

import TabsSessionsService from '../../../services/service.sessions.tabs';
import EventsSessionService from '../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

const MAX_BAR_HEIGHT = 16;
const MIN_BAR_HEIGHT = 4;
const MAX_FONT_SIZE = 12;
const MIN_FONT_SIZE = 8;

export class DataService {

    private _refs: number[] = [];
    private _ranges: IRange[] = [];
    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('MeasurementDataService');
    private _session: ControllerSessionTab | undefined;
    private _mode: EChartMode = EChartMode.aligned;
    private _barHeight: number = MAX_BAR_HEIGHT;
    private _fontSize: number = MAX_FONT_SIZE;
    private _subjects: {
        update: Subject<void>,  // Updates happens in scope of session
        change: Subject<void>, // Session was changed
    } = {
        update: new Subject(),
        change: new Subject(),
    };

    constructor() {
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
            this._onSessionChange.bind(this),
        );
        this._onSessionChange(TabsSessionsService.getActive());
    }

    destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].unsubscribe();
        });
    }

    public getObservable(): {
        update: Observable<void>,
        change: Observable<void>,
    } {
        return {
            update: this._subjects.update.asObservable(),
            change: this._subjects.change.asObservable(),
        };
    }

    public getMode(): EChartMode {
        return this._mode;
    }

    public toggleMode() {
        if (this._session === undefined) {
            return;
        }
        this._session.getTimestamp().setMode(this._mode === EChartMode.aligned ? EChartMode.scaled : EChartMode.aligned);
    }

    public getChartDataset(): {
        datasets: any[],
        labels: string[],
        maxY?: number
    } {
        switch (this._mode) {
            case EChartMode.aligned:
                return this._getChartDatasetModeAlign();
            case EChartMode.scaled:
                return this._getChartDatasetModeScale();
        }
    }

    public getRefs(): number[] {
        return this._refs;
    }

    public getMinTimestamp(): number {
        return this._session === undefined ? 0 : this._session.getTimestamp().getMinTimestamp();
    }

    public getMaxTimestamp(): number {
        return this._session === undefined ? 0 : this._session.getTimestamp().getMaxTimestamp();
    }

    private _getChartDatasetModeAlign(): {
        datasets: any[],
        labels: string[],
        maxY?: number
    } {
        this._refs = [];
        const groups: Map<number, IRange[]> = new Map();
        const labels: string[] = [];
        const datasets: any[] = [];
        this._getComplitedRanges().forEach((range: IRange) => {
            const ranges: IRange[] = groups.has(range.group) ? groups.get(range.group) : [];
            ranges.push(range);
            if (ranges.length > datasets.length) {
                datasets.push({
                    barPercentage: 0.5,
                    barThickness: 16,
                    backgroundColor: [],
                    hoverBackgroundColor: [],
                    data: [],
                });
            }
            groups.set(range.group, ranges);
        });
        datasets.forEach((dataset: any, index: number) => {
            groups.forEach((group: IRange[]) => {
                if (group[index] === undefined) {
                    dataset.data.push(0);
                    dataset.backgroundColor.push(scheme_color_0);
                    dataset.hoverBackgroundColor.push(scheme_color_0);
                } else {
                    dataset.data.push(group[index].duration);
                    dataset.backgroundColor.push(group[index].color);
                    dataset.hoverBackgroundColor.push(group[index].color);
                }
            });
            datasets[index] = dataset;
        });
        groups.forEach((group: IRange[]) => {
            this._refs.push(Math.min(...group.map(range => range.start.position), ...group.map(range => range.end.position)));
            labels.push(`${Math.min(...group.map(range => range.start.position), ...group.map(range => range.end.position))} - ${Math.max(...group.map(range => range.start.position), ...group.map(range => range.end.position))}`);
        });
        return {
            datasets: datasets,
            labels: labels,
        };
    }

    private _getChartDatasetModeScale(): {
        datasets: any[],
        labels: string[],
        maxY?: number
    } {
        const labels: string[] = [];
        const datasets: any[] = [];
        const groups: Map<number, IRange[]> = this._getGroups();
        let y: number = 1;
        let prev: { min: number, max: number } | undefined;
        groups.forEach((ranges: IRange[]) => {
            ranges.sort((a: IRange, b: IRange) => {
                return a.duration > b.duration ? 1 : -1;
            });
            if (prev !== undefined && ranges.length > 0) {
                const range = ranges[ranges.length - 1];
                const next: { min: number, max: number } = {
                    min: range.start.timestamp < range.end.timestamp ? range.start.timestamp : range.end.timestamp,
                    max: range.start.timestamp > range.end.timestamp ? range.start.timestamp : range.end.timestamp
                };
                const min: number = prev.max < next.min ? prev.max : next.max;
                const max: number = prev.max < next.min ? next.min : prev.min;
                const values: Array<{ x: number, y: number, duration?: number }> = [{
                    x: min < max ? min : max,
                    y: y - 0.5,
                },
                {
                    x: min > max ? min : max,
                    y: y - 0.5,
                    duration: Math.abs(max - min),
                }];
                datasets.push({
                    data: values,
                    borderColor: '#999999',
                    borderWidth: 1,
                    pointBackgroundColor: ['#999999', '#999999'],
                    pointBorderColor: ['#999999', '#999999'],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0,
                    showLine: true
                });
            }
            ranges.forEach((range: IRange, index: number) => {
                const rMin: number = range.start.timestamp < range.end.timestamp ? range.start.timestamp : range.end.timestamp;
                const rMax: number = range.start.timestamp > range.end.timestamp ? range.start.timestamp : range.end.timestamp;
                // y += 1;
                const values: Array<{ x: number, y: number, duration?: number, range?: boolean, row?: number }> = [{
                    x: rMin,
                    y: y,
                },
                {
                    x: rMax,
                    y: y,
                    duration: Math.abs(rMax - rMin),
                    row: range.start.position < range.end.position ? range.start.position : range.end.position,
                    range: true,
                }];
                datasets.push({
                    data: values,
                    borderColor: range.color,
                    borderWidth: this._barHeight,
                    pointBackgroundColor: [range.color, range.color],
                    pointBorderColor: [range.color, range.color],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0,
                    showLine: true
                });
                prev = {
                    min: range.start.timestamp < range.end.timestamp ? range.start.timestamp : range.end.timestamp,
                    max: range.start.timestamp > range.end.timestamp ? range.start.timestamp : range.end.timestamp
                };
            });
            y += 1;
        });
        return {
            datasets: datasets,
            labels: labels,
            maxY: y,
        };
    }

    private _getGroups(): Map<number, IRange[]> {
        const groups: Map<number, IRange[]> = new Map();
        this._getComplitedRanges().forEach((range: IRange) => {
            const ranges: IRange[] = groups.has(range.group) ? groups.get(range.group) : [];
            ranges.push(range);
            groups.set(range.group, ranges);
        });
        return groups;
    }

    private _getComplitedRanges(): IRange[] {
        return this._ranges.filter((range: IRange) => {
            return range.end !== undefined;
        });
    }

    private _refresh(ranges?: IRange[], change: boolean = false) {
        this._ranges = ranges instanceof Array ? ranges : (this._session === undefined ? [] : this._session.getTimestamp().getRanges());
        if (!change) {
            this._subjects.update.next();
        } else {
            this._subjects.change.next();
        }
    }

    private _onSessionChange(controller?: ControllerSessionTab) {
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].unsubscribe();
        });
        if (controller !== undefined) {
            this._sessionSubscriptions.change = controller.getTimestamp().getObservable().change.subscribe(this._onRangeChange.bind(this));
            this._sessionSubscriptions.update = controller.getTimestamp().getObservable().update.subscribe(this._onRangesUpdate.bind(this));
            this._sessionSubscriptions.mode = controller.getTimestamp().getObservable().mode.subscribe(this._onModeChange.bind(this));
            this._mode = controller.getTimestamp().getMode();
            this._session = controller;
        } else {
            this._session = undefined;
        }
        this._refresh(undefined, true);
    }

    private _onRangeChange(range: IRange) {
        this._refresh();
    }

    private _onRangesUpdate(ranges: IRange[]) {
        this._refresh(ranges);
    }

    private _onModeChange(mode: EChartMode) {
        this._mode = mode;
        this._refresh(undefined, true);
    }

}
