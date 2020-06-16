import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { ControllerSessionTabTimestamp, IRange } from '../../../controller/controller.session.tab.timestamp';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';
import { scheme_color_0, getContrastColor } from '../../../theme/colors';
import { Chart } from 'chart.js';

import TabsSessionsService from '../../../services/service.sessions.tabs';
import EventsSessionService from '../../../services/standalone/service.events.session';
import ViewsEventsService from '../../../services/standalone/service.views.events';
import ContextMenuService from '../../../services/standalone/service.contextmenu';
import OutputRedirectionsService from '../../../services/standalone/service.output.redirections';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-measurement',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewMeasurementComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    public _ng_ranges: IRange[] = [];
    public _ng_width: number = 0;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementComponent');
    private _session: ControllerSessionTab | undefined;
    private _destroy: boolean = false;
    private _chart: Chart | undefined;
    private _refs: number[] = [];

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
    }

    public ngOnDestroy() {
        this._destroy = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {

    }

    public ngAfterViewInit() {
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
            this._onSessionChange.bind(this),
        );
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(
            this._onResize.bind(this),
        );
        this._onResize();
        this._onSessionChange(TabsSessionsService.getActive());
    }

    public _ng_getController(): ControllerSessionTabTimestamp | undefined {
        if (this._session === undefined) {
            return undefined;
        }
        return this._session.getTimestamp();
    }

    public _ng_onContexMenu(event: MouseEvent, range: IRange | undefined) {
        if (this._session === undefined) {
            event.stopImmediatePropagation();
            event.preventDefault();
            return;
        }
        const items: IMenuItem[] = [
            { /* Delimiter */},
            {
                caption: `Remove`,
                handler: () => {
                    this._forceUpdate();
                },
                disabled: range === undefined,
            },
            {
                caption: `Remove All`,
                handler: () => {
                    this._forceUpdate();
                },
                disabled: this._session.getTimestamp().getCount() === 0,
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    private _build() {
        if (this._chart === undefined) {
            const data = this._getChartDataset();
            this._chart = new Chart('view-measurement-canvas', {
                type: 'horizontalBar',
                data: {
                    datasets: data.datasets,
                    labels: data.labels,
                },
                options: {
                    onClick: this._onBarClick.bind(this),
                    tooltips: {
                        enabled: false,
                    },
                    title: {
                        display: false,
                    },
                    legend: {
                        display: false,
                    },
                    hover: {
                        animationDuration: 0
                    },
                    responsiveAnimationDuration: 0,
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        xAxes: [{
                            gridLines: {
                                offsetGridLines: true
                            },
                            stacked: true
                        }],
                        yAxes: [{
                            stacked: true
                        }],
                    },
                    animation: {
                        duration: 1,
                        onComplete: function() {
                            const chartInstance = this.chart;
                            const ctx = chartInstance.ctx;
                            ctx.font = Chart.helpers.fontString(Chart.defaults.global.defaultFontSize, Chart.defaults.global.defaultFontStyle, Chart.defaults.global.defaultFontFamily);
                            ctx.textAlign = 'right';
                            ctx.textBaseline = 'middle';
                            this.data.datasets.forEach(function(dataset, i) {
                                const meta = chartInstance.controller.getDatasetMeta(i);
                                meta.data.forEach(function(bar, index) {
                                    if (dataset.data[index] === 0) {
                                        return;
                                    }
                                    ctx.fillStyle = getContrastColor(dataset.backgroundColor[index], true);
                                    ctx.fillText(`${dataset.data[index]} ms`, bar._model.x - 4, bar._model.y);
                                });
                            });
                        }
                    }
                }
            });
        } else {
            const data = this._getChartDataset();
            this._chart.data.datasets = data.datasets;
            this._chart.data.labels = data.labels;
            !this._destroy && this._chart.update();
        }
    }

    private _onBarClick(event?: MouseEvent, elements?: any[]) {
        if (this._session === undefined) {
            return;
        }
        if (!(elements instanceof Array)) {
            return;
        }
        if (elements.length === 0) {
            return;
        }
        if (typeof elements[0]._index !== 'number') {
            return;
        }
        const position: number = this._refs[elements[0]._index];
        if (isNaN(position) || !isFinite(position)) {
            return;
        }
        OutputRedirectionsService.select('measurement', this._session.getGuid(), position);
    }

    private _getChartDataset(): {
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
            labels.push(`${Math.min(...group.map(range => range.start.position))} - ${Math.max(...group.map(range => range.start.position))}`);
        });
        return {
            datasets: datasets,
            labels: labels,
        };
        // TODO: - [x] use fixed height of bar. Check responsive view for this case.
        //       - [x] remove seconds from labels (left side)
        //       - sorting: by region; by duration;
        //       - [x] grouping (stacked): common start (first point) and different end points.
        //       - [x] swap bookmark column and time-range column
        //       - [x] highlight number when bookmarked
        //       - [x] remove all / remove except
        //       - [x] bug with merge view: no scale higlighting (select first 10 files from examples, linux)
        //       - recent files dialog was empty
        /*
        return [{
            barPercentage: 0.5,
            barThickness: 8,
            backgroundColor: colors,
            hoverBackgroundColor: colors,
            data: values,
            stack: 'stack'
        }];
        */
    }

    private _onSessionChange(controller?: ControllerSessionTab) {
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].unsubscribe();
        });
        if (controller === undefined) {
            return;
        }
        this._sessionSubscriptions.change = controller.getTimestamp().getObservable().change.subscribe(this._onRangeChange.bind(this));
        this._sessionSubscriptions.update = controller.getTimestamp().getObservable().update.subscribe(this._onRangesUpdated.bind(this));
        this._session = controller;
        this._refresh();
    }

    private _refresh(ranges?: IRange[]) {
        this._ng_ranges = ranges instanceof Array ? ranges : this._session.getTimestamp().getRanges();
        this._build();
        this._forceUpdate();
    }

    private _onRangeChange(range: IRange) {
        this._refresh();
    }

    private _onRangesUpdated(ranges: IRange[]) {
        this._refresh(ranges);
    }

    private _onResize() {
        this._ng_width = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect().width;
        if (this._chart !== undefined && !this._destroy) {
            this._chart.update();
        }
    }

    private _getComplitedRanges(): IRange[] {
        return this._ng_ranges.filter((range: IRange) => {
            return range.end !== undefined;
        });
    }

    private _forceUpdate() {
        if (this._destroy) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
