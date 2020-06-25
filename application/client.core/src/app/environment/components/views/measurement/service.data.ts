import { Subscription, Subject, Observable } from 'rxjs';
import { ControllerSessionTabTimestamp, IRange } from '../../../controller/controller.session.tab.timestamp';
import { scheme_color_0, getContrastColor } from '../../../theme/colors';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';

import TabsSessionsService from '../../../services/service.sessions.tabs';
import EventsSessionService from '../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

export class DataService {

    private _refs: number[] = [];
    private _ranges: IRange[] = [];
    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('MeasurementDataService');
    private _session: ControllerSessionTab | undefined;
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

    public getChartDataset(): {
        datasets: any[],
        labels: string[],
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

    public getRefs(): number[] {
        return this._refs;
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
            this._sessionSubscriptions.update = controller.getTimestamp().getObservable().update.subscribe(this._onRangesUpdated.bind(this));
            this._session = controller;
        } else {
            this._session = undefined;
        }
        this._refresh(undefined, true);
    }

    private _onRangeChange(range: IRange) {
        this._refresh();
    }

    private _onRangesUpdated(ranges: IRange[]) {
        this._refresh(ranges);
    }

}
