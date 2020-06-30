import { Component, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, AfterContentInit, AfterViewInit, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { ControllerSessionTabTimestamp, IRange, EChartMode } from '../../../controller/controller.session.tab.timestamp';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';
import { scheme_color_2, getContrastColor } from '../../../theme/colors';
import { Chart } from 'chart.js';
import { DataService } from './service.data';

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

    @ViewChild('canvas', { static: true }) _ng_canvas: ElementRef<HTMLCanvasElement>;

    public _ng_width: number = 0;

    readonly CHART_UPDATE_DURATION: number = 75;

    private _heights: {
        container: number,
        charts: number,
    } = {
        container: 0,
        charts: 0,
    };
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementComponent');
    private _session: ControllerSessionTab | undefined;
    private _destroy: boolean = false;
    private _chart: {
        instance?: Chart,
        update: number,
        timer: any,
    } = {
        instance: undefined,
        update: 0,
        timer: undefined,
    };
    private _service: DataService | undefined;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
    }

    public ngOnDestroy() {
        this._destroy = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        if (this._chart.instance !== undefined) {
            this._chart.instance.destroy();
            this._chart.instance = undefined;
        }
        if (this._service !== undefined) {
            this._service.destroy();
            this._service = undefined;
        }
    }

    public ngAfterContentInit() {
    }

    public ngAfterViewInit() {
        this._service = new DataService();
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
            this._onSessionChange.bind(this),
        );
        this._subscriptions.update = this._service.getObservable().update.subscribe(
            this._onChartDataUpdate.bind(this),
        );
        this._subscriptions.change = this._service.getObservable().change.subscribe(
            this._onChartDataChange.bind(this),
        );
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(
            this._resize.bind(this),
        );
        this._build();
        this._onSessionChange(TabsSessionsService.getActive());
    }

    public _ng_onChartContexMenu(event: MouseEvent) {
        if (this._session === undefined) {
            event.stopImmediatePropagation();
            event.preventDefault();
            return;
        }
        const items: IMenuItem[] = [
            {
                caption: `Switch to: ${this._service.getMode() === EChartMode.aligned ? 'scaled' : 'aligned'}`,
                handler: () => {
                    this._service.toggleMode();
                },
            },
            { /* Delimiter */},
            {
                caption: `Remove All Ranges`,
                handler: () => {
                    if (this._session === undefined) {
                        return;
                    }
                    this._session.getTimestamp().drop();
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

    public _ng_getController(): ControllerSessionTabTimestamp | undefined {
        if (this._session === undefined) {
            return undefined;
        }
        return this._session.getTimestamp();
    }

    public _ng_getChartsHeight(): string {
        if (this._service === undefined) {
            return;
        }
        if (isNaN(this._heights.container) || !isFinite(this._heights.container)) {
            this._resize();
        }
        let height: number = this._service.getRangesCount() * this._service.SCALED_ROW_HEIGHT;
        height = height < this._heights.container ? this._heights.container : height;
        if (height !== this._heights.charts) {
            this._heights.charts = height;
            this._chartResizeUpdate();
        }
        return `${this._heights.charts}px`;
    }

    private _build() {
        if (this._ng_canvas === undefined || this._service === undefined) {
            return;
        }
        const data = this._service.getChartDataset();
        if (this._chart.instance === undefined) {
            const self = this;
            this._chart.instance = new Chart(this._ng_canvas.nativeElement, {
                type: 'scatter',
                data: {
                    datasets: data.datasets,
                },
                options: {
                    onClick: this._onScaleChartClick.bind(this),
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
                    responsive: false,
                    maintainAspectRatio: false,
                    scales: {
                        xAxes: [{
                            gridLines: {
                                offsetGridLines: true
                            },
                            ticks: {
                                display: false,
                                min: this._service.getMode() === EChartMode.aligned ? 0 : this._service.getMinTimestamp(),
                                max: this._service.getMode() === EChartMode.aligned ? this._service.getMaxDuration() : this._service.getMaxTimestamp()
                            },
                        }],
                        yAxes: [{
                            ticks: {
                                display: false,
                                min: 0,
                                max: data.maxY + 1,
                                beginAtZero: true,
                                stepSize: 1,
                                maxTicksLimit: 100,
                            },
                        }],
                    },
                    animation: {
                        duration: 1,
                        onComplete: function() {
                            if (self._service === undefined) {
                                return;
                            }
                            const chartInstance = this.chart;
                            const ctx = chartInstance.ctx;
                            ctx.font = Chart.helpers.fontString(Chart.defaults.global.defaultFontSize, Chart.defaults.global.defaultFontStyle, Chart.defaults.global.defaultFontFamily);
                            ctx.textAlign = 'right';
                            this.data.datasets.forEach(function(dataset, i) {
                                const meta = chartInstance.controller.getDatasetMeta(i);
                                const duration: number = dataset.data[1].duration;
                                if (dataset.data[1].range === true) {
                                    ctx.font = Chart.helpers.fontString(Chart.defaults.global.defaultFontSize, Chart.defaults.global.defaultFontStyle, Chart.defaults.global.defaultFontFamily);
                                    ctx.fillStyle = getContrastColor(dataset.borderColor, true);
                                    ctx.textBaseline = 'middle';
                                } else {
                                    ctx.font = Chart.helpers.fontString(Chart.defaults.global.defaultFontSize * 0.8, Chart.defaults.global.defaultFontStyle, Chart.defaults.global.defaultFontFamily);
                                    ctx.fillStyle = scheme_color_2;
                                    ctx.textBaseline = 'top';
                                }
                                ctx.fillText(`${duration} ms`, meta.data[1]._model.x - 4, meta.data[1]._model.y + 1);
                            });
                        }
                    }
                }
            });
        } else {
            this._chart.instance.data.datasets = data.datasets;
            this._chart.instance.options.scales.xAxes[0].ticks.min = this._service.getMode() === EChartMode.aligned ? 0 : this._service.getMinTimestamp();
            this._chart.instance.options.scales.xAxes[0].ticks.max = this._service.getMode() === EChartMode.aligned ? this._service.getMaxDuration() : this._service.getMaxTimestamp();
            this._chart.instance.options.scales.yAxes[0].ticks.max = data.maxY + 1;
        }
        this._resize();
    }

    private _onScaleChartClick(event?: MouseEvent) {
        if (this._session === undefined || this._service === undefined) {
            return;
        }
        if (this._chart.instance.data === undefined || !(this._chart.instance.data.datasets instanceof Array)) {
            return;
        }
        const target = this._getDatasetOnClick(event);
        if (target === undefined) {
            return;
        }
        console.log(`${target.range.start.position} - ${target.range.end.position} / ${target.range.duration}`);
    }

    private _getDatasetOnClick(event?: MouseEvent): {
        range: IRange,
        x: number,
        y: number
    } | undefined {
        if (event === undefined) {
            return undefined;
        }
        let match;
        this._chart.instance.data.datasets.forEach((dataset, index: number) => {
            if (match !== undefined) {
                return;
            }
            if ((dataset as any).range === undefined) {
                // It might be distance range, which has to be ignored
                return;
            }
            const meta = this._chart.instance.getDatasetMeta(index);
            if (meta.data.length !== 2) {
                return;
            }
            const rect = {
                x1: meta.data[0]._view.x,
                y1: meta.data[0]._view.y - this._service.MAX_BAR_HEIGHT / 2,
                x2: meta.data[1]._view.x,
                y2: meta.data[1]._view.y + this._service.MAX_BAR_HEIGHT / 2,
            };
            if (event.offsetX >= rect.x1 && event.offsetX <= rect.x2 && event.offsetY >= rect.y1 && event.offsetY <= rect.y2) {
                match = {
                    range: (dataset as any).range,
                    x: event.clientX,
                    y: event.clientY
                };
            }
        });
        return match;
    }

    private _onSessionChange(controller?: ControllerSessionTab) {
        if (controller === undefined) {
            return;
        }
        this._session = controller;
    }

    private _onChartDataUpdate() {
        this._build();
    }

    private _onChartDataChange() {
        if (this._chart.instance !== undefined) {
            this._chart.instance.destroy();
            this._chart.instance = undefined;
        }
        this._build();
    }

    private _resize() {
        const size = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        this._ng_width = size.width;
        this._heights.container = size.height;
        this._chartResizeUpdate();
        this._forceUpdate();
    }

    private _chartResizeUpdate() {
        if (this._service === undefined || this._chart.instance === undefined || this._destroy) {
            return;
        }
        clearTimeout(this._chart.timer);
        if (this._chart.update === 0) {
            this._chart.update = Date.now();
        }
        const duration: number = this.CHART_UPDATE_DURATION - Math.abs(Date.now() - this._chart.update);
        if (duration <= 0) {
            this._chart.instance.update();
            this._chart.instance.resize();
            this._chart.update = 0;
            this._chart.timer = undefined;
        } else {
            this._chart.timer = setTimeout(this._chartResizeUpdate.bind(this), duration);
        }
    }

    private _forceUpdate() {
        if (this._destroy) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
