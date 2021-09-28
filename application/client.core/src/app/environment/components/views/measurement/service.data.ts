import { Subscription, Subject, Observable } from 'rxjs';
import {
    IRange,
    EChartMode,
} from '../../../controller/session/dependencies/timestamps/session.dependency.timestamps';
import { Session } from '../../../controller/session/session';
import { IPC } from '../../../services/service.electron.ipc';

import TabsSessionsService from '../../../services/service.sessions.tabs';
import EventsSessionService from '../../../services/standalone/service.events.session';
import ElectronIpcService from '../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export { EChartMode };

export interface IZoomEvent {
    x: number;
    width: number;
    change: number;
}

export interface IMoveEvent {
    width: number;
    change: number;
}

export class DataService {
    public readonly SCALED_ROW_HEIGHT: number = 50;
    public readonly MAX_BAR_HEIGHT: number = 16;
    public readonly MIN_BAR_HEIGHT: number = 2;
    public readonly MIN_ZOOMING_PX: number = 20;
    public readonly MIN_DISTANCE_SCALE_RATE: number = 0.5;

    private _refs: number[] = [];
    private _ranges: IRange[] = [];
    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('MeasurementDataService');
    private _session: Session | undefined;
    private _mode: EChartMode = EChartMode.aligned;
    private _offset: number = 1;
    private _subjects: {
        update: Subject<void>; // Updates happens in scope of session
        change: Subject<void>; // Session was changed
        zoom: Subject<void>;
        mode: Subject<void>;
    } = {
        update: new Subject(),
        change: new Subject(),
        zoom: new Subject(),
        mode: new Subject(),
    };

    constructor() {
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
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
        update: Observable<void>;
        change: Observable<void>;
        zoom: Observable<void>;
        mode: Observable<void>;
    } {
        return {
            update: this._subjects.update.asObservable(),
            change: this._subjects.change.asObservable(),
            zoom: this._subjects.zoom.asObservable(),
            mode: this._subjects.mode.asObservable(),
        };
    }

    public getMode(): EChartMode {
        return this._mode;
    }

    public toggleMode() {
        if (this._session === undefined) {
            return;
        }
        this._session
            .getTimestamp()
            .setMode(this._mode === EChartMode.aligned ? EChartMode.scaled : EChartMode.aligned);
    }

    public getChartDataset(overview: boolean = false): {
        datasets: any[];
        labels: string[];
        maxY?: number;
    } {
        if (overview) {
            return this._getChartDatasetModeScale(true);
        } else {
            switch (this._mode) {
                case EChartMode.aligned:
                    return this._getChartDatasetModeAlign();
                case EChartMode.scaled:
                    return this._getChartDatasetModeScale();
            }
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

    public getMaxDuration(): number {
        return this._session === undefined ? 0 : this._getMaxDurationPerGroups();
    }

    public getMinXAxe(applyCursorOffset: boolean = true): number {
        const cursor = this.getCursorState();
        if (cursor === undefined) {
            return 0;
        }
        const min = this.getMinTimestamp();
        return min + (applyCursorOffset ? cursor.left : 0);
    }

    public getMaxXAxe(applyCursorOffset: boolean = true): number {
        const cursor = this.getCursorState();
        if (cursor === undefined) {
            return 0;
        }
        const max = this.getMaxTimestamp() - this._offset;
        return max - (applyCursorOffset ? cursor.right : 0);
    }

    public getRangesCount(): number {
        return this._getComplitedRanges().length;
    }

    public getGroups(): Map<number, IRange[]> {
        const groups: Map<number, IRange[]> = new Map();
        this._getComplitedRanges().forEach((range: IRange) => {
            const ranges: IRange[] = groups.has(range.group)
                ? (groups.get(range.group) as IRange[])
                : [];
            ranges.push(range);
            groups.set(range.group, ranges);
        });
        groups.forEach((ranges: IRange[], groupId: number) => {
            ranges = ranges.sort((a, b) => {
                return a.start.position < b.start.position ? -1 : 1;
            });
            groups.set(groupId, ranges);
        });
        return groups;
    }

    public zoom(event: IZoomEvent) {
        if (this._session === undefined) {
            return;
        }
        const cursor = this.getCursorState();
        if (cursor === undefined) {
            return;
        }
        const point: number = event.x / event.width;
        const duration: number = this.getMaxTimestamp() - this._offset - this.getMinTimestamp();
        const limit: number = (duration / event.width) * this.MIN_ZOOMING_PX;
        const minT = this.getMinTimestamp();
        const maxT = this.getMaxTimestamp() - this._offset;
        const min = minT + cursor.left;
        const max = maxT - cursor.right;
        const step = Math.abs(max - min) / event.width;
        let left = cursor.left + event.change * point * step;
        let right = cursor.right + event.change * (1 - point) * step;
        if (minT + left < minT) {
            left = 0;
        }
        if (maxT - right > maxT) {
            right = 0;
        }
        if (maxT - right - (minT + left) < limit) {
            const allowed = duration - limit;
            right = allowed * (right / (right + left));
            left = allowed - right;
        }
        this._session.getTimestamp().setZoomOffsets(left, right);
    }

    public setZoomOffsets(left: number, right: number) {
        if (this._session === undefined) {
            return;
        }
        this._session.getTimestamp().setZoomOffsets(left, right);
    }

    public move(event: IMoveEvent) {
        const cursor = this.getCursorState();
        if (cursor === undefined) {
            return;
        }
        const minT = this.getMinTimestamp();
        const maxT = this.getMaxTimestamp() - this._offset;
        const min = minT + cursor.left;
        const max = maxT - cursor.right;
        const _left = cursor.left;
        const _right = cursor.right;
        const step = Math.abs(max - min) / event.width;
        let left = cursor.left + event.change * step;
        let right = cursor.right - event.change * step;
        if (left < 0) {
            left = 0;
            right = cursor.right + _left;
        } else if (maxT - right > maxT) {
            right = 0;
            left = cursor.left + _right;
        }
        this.setZoomOffsets(left, right);
    }

    public getCursorState():
        | undefined
        | {
              left: number;
              right: number;
          } {
        if (this._session === undefined) {
            return undefined;
        }
        return this._session.getTimestamp().getCursorState();
    }

    public getDuration(): number {
        return this.getMaxTimestamp() - this._offset - this.getMinTimestamp();
    }

    public getOptimizationState(): boolean {
        if (this._session === undefined) {
            return false;
        }
        return this._session.getTimestamp().getOptimization();
    }

    public toggleOptimizationState() {
        if (this._session === undefined) {
            return;
        }
        this._session
            .getTimestamp()
            .setOptimization(!this._session.getTimestamp().getOptimization());
    }

    public exportToCSV() {
        const id: string = Toolkit.guid();
        ElectronIpcService.request<IPC.TimestampExtractResponse>(
            new IPC.TimestampExportCSVRequest({
                id: id,
                csv: this._getRangesAsCSV(),
            }),
            IPC.TimestampExportCSVResponse,
        ).then((response) => {
            if (response.error) {
                this._logger.warn(`Fail to export time ranges data due error: ${response.error}`);
            }
        });
    }

    public discover(update: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._session === undefined) {
                return reject(new Error(this._logger.warn(`Session object isn't available`)));
            }
            this._session.getTimestamp().discover(update).then(resolve).catch(reject);
            // TODO: Probably we should prevent multiple execution of discover feature - it doesn't make sence
            // to start discove several times for same session.
        });
    }

    private _getRangesAsCSV(): string {
        const VALUE_DIV = ',';
        const content: string[] = [
            [
                'Range #',
                'Start Timestamp',
                'End Timestamp',
                'Duration',
                'Start Row Number',
                'End Row Number',
                'Start Row',
                'End Row',
            ].join(VALUE_DIV),
        ];
        this.getGroups().forEach((ranges: IRange[], groupId: number) => {
            ranges.forEach((range: IRange, index: number) => {
                const values: string[] = [];
                if (
                    range.end === undefined ||
                    range.start === undefined ||
                    range.start.timestamp === undefined ||
                    range.end.timestamp === undefined
                ) {
                    return;
                }
                values.push(index === 0 ? groupId.toString() : '');
                values.push(
                    ...[
                        range.start.timestamp.toString(),
                        range.end.timestamp.toString(),
                        range.duration.toString(),
                        range.start.position.toString(),
                        range.end.position.toString(),
                        `"${range.start.str.replace(/"/gi, '""')}"`,
                        `"${range.end.str.replace(/"/gi, '""')}"`,
                    ],
                );
                content.push(values.join(VALUE_DIV));
            });
        });
        return content.join('\n');
    }

    private _getChartDatasetModeAlign(): {
        datasets: any[];
        labels: string[];
        maxY?: number;
    } {
        const labels: string[] = [];
        const datasets: any[] = [];
        const groups: Map<number, IRange[]> = this.getGroups();
        let y: number = 1;
        groups.forEach((ranges: IRange[], groupId: number) => {
            let offset: number = 0;
            ranges.forEach((range: IRange, index: number) => {
                if (
                    range.end === undefined ||
                    range.start === undefined ||
                    range.start.position === undefined ||
                    range.end.position === undefined
                ) {
                    return;
                }
                const normalized = this._getNormalizedRange(range);
                // y += 1;
                const values: Array<{
                    x: number;
                    y: number;
                    duration?: number;
                    range?: boolean;
                    row?: number;
                }> = [
                    {
                        x: offset,
                        y: y,
                    },
                    {
                        x: offset + normalized.duration,
                        y: y,
                        duration: normalized.duration,
                        row:
                            range.start.position < range.end.position
                                ? range.start.position
                                : range.end.position,
                        range: true,
                    },
                ];
                datasets.push({
                    data: values,
                    borderColor: range.color,
                    borderWidth: this.MAX_BAR_HEIGHT,
                    pointBackgroundColor: [range.color, range.color],
                    pointBorderColor: [range.color, range.color],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0,
                    showLine: true,
                    range: range,
                });
                offset += normalized.duration;
            });
            y += 1;
        });
        return {
            datasets: datasets,
            labels: labels,
            maxY: y,
        };
    }

    private _getChartDatasetModeScale(overview: boolean = false): {
        datasets: any[];
        labels: string[];
        maxY?: number;
    } {
        if (this._session === undefined) {
            return { datasets: [], labels: [], maxY: 0 };
        }
        this._offset = 0;
        const labels: string[] = [];
        let datasets: any[] = [];
        const groups: Map<number, IRange[]> = this.getGroups();
        let y: number = 1;
        let prev: any;
        const params = {
            distance: {
                count: 0,
                duration: 0,
                middle: 0,
            },
            ranges: {
                count: 0,
                duration: 0,
                middle: 0,
            },
        };
        // Building datasets
        groups.forEach((ranges: IRange[], groupId: number) => {
            const borders = this._getGroupBorders(groupId);
            if (prev !== undefined && ranges.length > 0) {
                const values: Array<{ x: number; y: number; duration?: number }> = [
                    {
                        x: borders.max,
                        y: y - 0.5,
                    },
                    {
                        x: prev.min,
                        y: y - 0.5,
                        duration: Math.abs(borders.max - prev.min),
                    },
                ];
                datasets.push({
                    data: values,
                    borderColor: '#999999',
                    borderWidth: overview ? 0 : 1,
                    pointBackgroundColor: ['#999999', '#999999'],
                    pointBorderColor: ['#999999', '#999999'],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0,
                    showLine: !overview,
                });
                params.distance.count += 1;
                params.distance.duration += values[1].duration as number;
            }
            let offset: number = borders.min;
            ranges.forEach((range: IRange, index: number) => {
                if (
                    range.end === undefined ||
                    range.start === undefined ||
                    range.start.position === undefined ||
                    range.end.position === undefined
                ) {
                    return;
                }
                const normalized = this._getNormalizedRange(range);
                // y += 1;
                const values: Array<{
                    x: number;
                    y: number;
                    duration?: number;
                    range?: boolean;
                    row?: number;
                }> = [
                    {
                        x: offset,
                        y: y,
                    },
                    {
                        x: offset + normalized.duration,
                        y: y,
                        duration: normalized.duration,
                        row:
                            range.start.position < range.end.position
                                ? range.start.position
                                : range.end.position,
                        range: true,
                    },
                ];
                datasets.push({
                    data: values,
                    borderColor: range.color,
                    borderWidth: overview ? this.MIN_BAR_HEIGHT : this.MAX_BAR_HEIGHT,
                    pointBackgroundColor: [range.color, range.color],
                    pointBorderColor: [range.color, range.color],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0,
                    showLine: true,
                    range: range,
                });
                offset += normalized.duration;
                params.ranges.count += 1;
                params.ranges.duration += values[1].duration as number;
            });
            prev = borders;
            y += 1;
        });
        if (this._session.getTimestamp().getOptimization()) {
            params.distance.middle = params.distance.duration / params.distance.count;
            params.ranges.middle = params.ranges.duration / params.ranges.count;
            const rate: number = params.ranges.middle / params.distance.middle;
            if (rate < this.MIN_DISTANCE_SCALE_RATE) {
                // Distances have to be optimized
                const targetMiddle = params.ranges.middle / this.MIN_DISTANCE_SCALE_RATE;
                const change = targetMiddle / params.distance.middle;
                datasets.reverse();
                datasets = datasets.map((dataset) => {
                    if (dataset.range !== undefined) {
                        dataset.data[0].x -= this._offset;
                        dataset.data[1].x -= this._offset;
                    } else {
                        dataset.data[0].x -= this._offset;
                        const move = Math.floor(dataset.data[1].duration * change);
                        dataset.data[1].x = dataset.data[0].x + move;
                        this._offset += dataset.data[1].duration - move;
                        dataset.optimized = true;
                    }
                    return dataset;
                });
                datasets.reverse();
            }
        }
        return {
            datasets: datasets,
            labels: labels,
            maxY: y,
        };
    }

    private _getGroupBorders(group: number): { min: number; max: number; duration: number } {
        let min: number = Infinity;
        let max: number = -1;
        this._getComplitedRanges().forEach((range: IRange) => {
            if (
                range.end === undefined ||
                range.start === undefined ||
                range.start.timestamp === undefined ||
                range.end.timestamp === undefined
            ) {
                return;
            }
            if (range.group !== group) {
                return;
            }
            if (range.end.timestamp < min) {
                min = range.end.timestamp;
            }
            if (range.start.timestamp < min) {
                min = range.start.timestamp;
            }
            if (range.end.timestamp > max) {
                max = range.end.timestamp;
            }
            if (range.start.timestamp > max) {
                max = range.start.timestamp;
            }
        });
        return { min: min, max: max, duration: Math.abs(max - min) };
    }

    private _getMaxDurationPerGroups(): number {
        const groups = this.getGroups();
        let duration = -1;
        groups.forEach((_, groupId: number) => {
            const borders = this._getGroupBorders(groupId);
            if (duration < borders.duration) {
                duration = borders.duration;
            }
        });
        return duration;
    }

    private _getComplitedRanges(): IRange[] {
        return this._ranges
            .filter((range: IRange) => {
                return range.end !== undefined;
            })
            .sort((a: IRange, b: IRange) => {
                if (a.start.timestamp === undefined || b.start.timestamp === undefined) {
                    return 0;
                }
                return a.start.timestamp < b.start.timestamp ? 1 : -1;
            });
    }

    private _getNormalizedRange(range: IRange): { min: number; max: number; duration: number } {
        if (
            range.end === undefined ||
            range.start === undefined ||
            range.start.timestamp === undefined ||
            range.end.timestamp === undefined
        ) {
            return { min: 0, max: 0, duration: 0 };
        }
        const result = {
            min:
                range.start.timestamp < range.end.timestamp
                    ? range.start.timestamp
                    : range.end.timestamp,
            max:
                range.start.timestamp > range.end.timestamp
                    ? range.start.timestamp
                    : range.end.timestamp,
            duration: 0,
        };
        result.duration = Math.abs(result.max - result.min);
        return result;
    }

    private _refresh(ranges?: IRange[], change: boolean = false) {
        this._ranges =
            ranges instanceof Array
                ? ranges
                : this._session === undefined
                ? []
                : this._session.getTimestamp().getRanges();
        if (!change) {
            this._subjects.update.next();
        } else {
            this._subjects.change.next();
        }
    }

    private _onSessionChange(controller?: Session) {
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].unsubscribe();
        });
        if (controller !== undefined) {
            this._sessionSubscriptions.update = controller
                .getTimestamp()
                .getObservable()
                .update.subscribe(this._onRangesUpdate.bind(this));
            this._sessionSubscriptions.mode = controller
                .getTimestamp()
                .getObservable()
                .mode.subscribe(this._onModeChange.bind(this));
            this._sessionSubscriptions.zoom = controller
                .getTimestamp()
                .getObservable()
                .zoom.subscribe(this._onZoom.bind(this));
            this._sessionSubscriptions.optimization = controller
                .getTimestamp()
                .getObservable()
                .optimization.subscribe(this._onOptimization.bind(this));
            this._mode = controller.getTimestamp().getMode();
            this._session = controller;
        } else {
            this._session = undefined;
        }
        this._refresh(undefined, true);
    }

    private _onRangesUpdate(ranges: IRange[]) {
        this._refresh(ranges);
    }

    private _onModeChange(mode: EChartMode) {
        this._mode = mode;
        this._refresh(undefined, true);
        this._subjects.mode.next();
    }

    private _onOptimization() {
        this._refresh(undefined, true);
    }

    private _onZoom() {
        this._subjects.zoom.next();
    }
}
