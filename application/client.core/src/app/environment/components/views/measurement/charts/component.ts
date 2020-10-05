import { Component, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, AfterContentInit, AfterViewInit, ViewContainerRef, Input, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { ControllerSessionTabTimestamp, IRange, EChartMode } from '../../../../controller/controller.session.tab.timestamps';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { scheme_color_2, getContrastColor } from '../../../../theme/colors';
import { Chart } from 'chart.js';
import { DataService, IZoomEvent } from '../service.data';

import TabsSessionsService from '../../../../services/service.sessions.tabs';
import EventsSessionService from '../../../../services/standalone/service.events.session';
import ViewsEventsService from '../../../../services/standalone/service.views.events';
import ContextMenuService from '../../../../services/standalone/service.contextmenu';
import OutputRedirectionsService, { EParent } from '../../../../services/standalone/service.output.redirections';

import * as Toolkit from 'chipmunk.client.toolkit';

enum EScrollingMode {
    scrollingY = 'scrollingY',
    scrollingX = 'scrollingX',
    zooming = 'zooming',
}

@Component({
    selector: 'app-views-measurement-chart',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewMeasurementChartComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    @Input() service: DataService;

    @ViewChild('canvas', { static: true }) _ng_canvas: ElementRef<HTMLCanvasElement>;

    readonly CHART_UPDATE_DURATION: number = 60;
    readonly CHART_LEN_PX = 8;

    private _sizes: {
        container: {
            width: number,
            height: number,
        },
        charts: {
            height: number,
        },
    } = {
        container: {
            width: 0,
            height: 0,
        },
        charts: {
            height: 0,
        },
    };
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementChartComponent');
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
    private _cursor: {
        left: number,
    } = {
        left: -1,
    };
    private _scrolling: EScrollingMode = EScrollingMode.zooming;

    @HostListener('wheel', ['$event']) _ng_onWheel(event: WheelEvent) {
        if (this._scrolling === EScrollingMode.scrollingY) {
            (this._vcRef.element.nativeElement as HTMLElement).scrollTop += event.deltaY;
            return;
        }
        if (this.service.getMode() === EChartMode.aligned) {
            return;
        }
        const horizontal: boolean = Math.abs(event.deltaX) > Math.abs(event.deltaY);
        if (this._scrolling === EScrollingMode.scrollingX || horizontal) {
            this.service.move({
                change: horizontal ? event.deltaX : -event.deltaY,
                width: this._sizes.container.width,
            });
        } else {
            this.service.zoom({
                x: event.offsetX,
                change: -event.deltaY,
                width: this._sizes.container.width,
            });
        }
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
        this._onWinKeyDown = this._onWinKeyDown.bind(this);
        this._onWinKeyUp = this._onWinKeyUp.bind(this);
        window.addEventListener('keydown', this._onWinKeyDown);
        window.addEventListener('keyup', this._onWinKeyUp);
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
        window.removeEventListener('keydown', this._onWinKeyDown);
        window.removeEventListener('keyup', this._onWinKeyUp);
    }

    public ngAfterContentInit() {
    }

    public ngAfterViewInit() {
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
            this._onSessionChange.bind(this),
        );
        this._subscriptions.update = this.service.getObservable().update.subscribe(
            this._onChartDataUpdate.bind(this),
        );
        this._subscriptions.change = this.service.getObservable().change.subscribe(
            this._onChartDataChange.bind(this),
        );
        this._subscriptions.zoom = this.service.getObservable().zoom.subscribe(
            this._onChartDataZoom.bind(this),
        );
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(
            this._resize.bind(this),
        );
        this._build();
        this._onSessionChange(TabsSessionsService.getActive());
    }

    public _ng_onMouseMove(event: MouseEvent) {
        this._cursor.left = event.offsetX;
        this._forceUpdate();
    }

    public _ng_onChartContexMenu(event: MouseEvent) {
        if (this._session === undefined) {
            event.stopImmediatePropagation();
            event.preventDefault();
            return;
        }
        const target = this._getDatasetOnClick(event);
        const items: IMenuItem[] = [
            {
                caption: `Switch to: ${this.service.getMode() === EChartMode.aligned ? 'scaled' : 'aligned'}`,
                handler: () => {
                    this.service.toggleMode();
                },
            },
        ];
        if (target !== undefined || this._session.getTimestamp().getCount() !== 0) {
            items.push({ /* Delimiter */});
        }
        if (target !== undefined) {
            items.push(...[
                {
                    caption: target === undefined ? 'Remove this range' : `Remove this range: ${target.range.start.position} - ${target.range.end.position} / ${target.range.duration}`,
                    handler: () => {
                        if (this._session === undefined) {
                            return;
                        }
                        this._session.getTimestamp().removeRange(target.range.id);
                    },
                },
                {
                    caption: `Remove all except this`,
                    handler: () => {
                        if (this._session === undefined) {
                            return;
                        }
                        this._session.getTimestamp().clear([target.range.id]);
                    },
                },
            ]);
        }
        if (this._session.getTimestamp().getCount() !== 0) {
            items.push({
                caption: `Remove All Ranges`,
                handler: () => {
                    if (this._session === undefined) {
                        return;
                    }
                    this._session.getTimestamp().clear();
                },
            });
        }
        if (this.service.getMode() === EChartMode.scaled) {
            items.push(...[
                { /* Delimiter */},
                {
                    caption: this.service.getOptimizationState() ? `Do not optimize duration` : `Optimize duration`,
                    handler: () => {
                        this.service.toggleOptimizationState();
                    },
                },
            ]);
        }
        if (target !== undefined) {
            items.push(...[
                { /* Delimiter */},
                {
                    caption: `Go to row: ${target.range.start.position}`,
                    handler: () => {
                        if (this._session === undefined) {
                            return;
                        }
                        OutputRedirectionsService.select(EParent.timemeasurement, this._session.getGuid(), target.range.start.position);
                    },
                },
                {
                    caption: `Go to row: ${target.range.end.position}`,
                    handler: () => {
                        if (this._session === undefined) {
                            return;
                        }
                        OutputRedirectionsService.select(EParent.timemeasurement, this._session.getGuid(), target.range.end.position);
                    },
                }
            ]);
        }
        if (this._session.getTimestamp().getCount() > 0) {
            items.push(...[
                { /* Delimiter */},
                {
                    caption: `Export to CSV file`,
                    handler: () => {
                        if (this._session === undefined) {
                            return;
                        }
                        this.service.exportToCSV();
                    },
                },
            ]);
        }
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    public _ng_getChartsHeight(): string {
        if (this.service === undefined) {
            return;
        }
        return `${this._sizes.charts.height}px`;
    }

    public _ng_getCursorPosition(): string | undefined {
        return `${this._cursor.left}px`;
    }

    private _build() {
        if (this._ng_canvas === undefined || this.service === undefined) {
            return;
        }
        const data = this.service.getChartDataset();
        if (this._chart.instance === undefined) {
            const self = this;
            this._chart.instance = new Chart(this._ng_canvas.nativeElement, {
                type: 'scatter',
                data: {
                    datasets: data.datasets,
                },
                options: {
                    onClick: this._onChartClick.bind(this),
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
                                min: this.service.getMode() === EChartMode.aligned ? 0 : this.service.getMinXAxe(),
                                max: this.service.getMode() === EChartMode.aligned ? this.service.getMaxDuration() : this.service.getMaxXAxe()
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
                            if (self.service === undefined) {
                                return;
                            }
                            const chartInstance = this.chart;
                            const ctx = chartInstance.ctx;
                            ctx.font = Chart.helpers.fontString(Chart.defaults.global.defaultFontSize, Chart.defaults.global.defaultFontStyle, Chart.defaults.global.defaultFontFamily);
                            ctx.textAlign = 'right';
                            ctx.textBaseline = 'top';
                            this.data.datasets.forEach(function(dataset, i) {
                                const rect = self._getBarRect(chartInstance.controller.getDatasetMeta(i));
                                if (rect === undefined) {
                                    return;
                                }
                                const duration: number = dataset.data[1].duration;
                                const label: string = `${duration} ms`;
                                if (label.length * self.CHART_LEN_PX > rect.w) {
                                    return;
                                }
                                if (dataset.data[1].range === true) {
                                    ctx.font = Chart.helpers.fontString(Chart.defaults.global.defaultFontSize, Chart.defaults.global.defaultFontStyle, Chart.defaults.global.defaultFontFamily);
                                    ctx.fillStyle = getContrastColor(dataset.borderColor, true);
                                } else {
                                    ctx.font = Chart.helpers.fontString(Chart.defaults.global.defaultFontSize * 0.8, Chart.defaults.global.defaultFontStyle, Chart.defaults.global.defaultFontFamily);
                                    ctx.fillStyle = scheme_color_2;
                                }
                                ctx.fillText(`${duration} ms`, rect.x2 - 4, dataset.data[1].range === true ? rect.y1 + 3 : rect.y1 - 2);
                            });
                        }
                    }
                }
            });
        } else {
            this._chart.instance.data.datasets = data.datasets;
            this._chart.instance.options.scales.xAxes[0].ticks.min = this.service.getMode() === EChartMode.aligned ? 0 : this.service.getMinXAxe();
            this._chart.instance.options.scales.xAxes[0].ticks.max = this.service.getMode() === EChartMode.aligned ? this.service.getMaxDuration() : this.service.getMaxXAxe();
            this._chart.instance.options.scales.yAxes[0].ticks.max = data.maxY + 1;
        }
        this._resize(true);
    }

    private _onChartClick(event?: MouseEvent) {
        if (this._session === undefined || this.service === undefined) {
            return;
        }
        if (this._chart.instance.data === undefined || !(this._chart.instance.data.datasets instanceof Array)) {
            return;
        }
        const target = this._getDatasetOnClick(event);
        if (target === undefined) {
            return;
        }
        OutputRedirectionsService.select(
            EParent.notassigned,
            this._session.getGuid(),
            target.range.start.position < target.range.end.position ? target.range.start.position : target.range.end.position,
        );
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
            const rect = this._getBarRect(this._chart.instance.getDatasetMeta(index));
            if (rect === undefined) {
                return;
            }
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

    private _getBarRect(meta: any): undefined | { x1: number, y1: number, x2: number, y2: number, w: number, h: number } {
        if (meta.data.length !== 2) {
            return undefined;
        }
        const y1 = meta.data[0]._view.y - this.service.MAX_BAR_HEIGHT / 2;
        const y2 = meta.data[1]._view.y + this.service.MAX_BAR_HEIGHT / 2;
        return {
            x1: meta.data[0]._view.x,
            y1: y1,
            x2: meta.data[1]._view.x,
            y2: y2,
            w: meta.data[1]._view.x - meta.data[0]._view.x,
            h: y2 - y1,
        };
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

    private _onChartDataZoom() {
        if (this.service === undefined || this._chart === undefined) {
            return;
        }
        if (this.service.getMode() === EChartMode.aligned) {
            return;
        }
        this._chart.instance.options.scales.xAxes[0].ticks.min = this.service.getMinXAxe();
        this._chart.instance.options.scales.xAxes[0].ticks.max = this.service.getMaxXAxe();
        this._chartResizeUpdate();
    }

    private _resize(force: boolean = false) {
        if (!force && (this._sizes.container.height !== 0 && !isNaN(this._sizes.container.height) && isFinite(this._sizes.container.height))) {
            return;
        }
        // Container
        const rect = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        this._sizes.container.height = rect.height;
        this._sizes.container.width = rect.width;
        // Vertical chart size
        let height: number = this.service.getGroups().size * this.service.SCALED_ROW_HEIGHT;
        height = height < this._sizes.container.height ? this._sizes.container.height : height;
        if (height !== this._sizes.charts.height) {
            this._sizes.charts.height = height;
        }
        this._chartResizeUpdate();
        this._forceUpdate();
    }

    private _chartResizeUpdate() {
        if (this.service === undefined || this._chart.instance === undefined || this._destroy) {
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

    private _onWinKeyDown(event: KeyboardEvent) {
        if (event.ctrlKey) {
            this._scrolling = EScrollingMode.scrollingY;
        } else if (event.shiftKey) {
            this._scrolling = EScrollingMode.scrollingX;
        } else {
            this._scrolling = EScrollingMode.zooming;
        }
    }

    private _onWinKeyUp(event: KeyboardEvent) {
        this._scrolling = EScrollingMode.zooming;
    }

    private _forceUpdate() {
        if (this._destroy) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
