import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    ViewChild,
    ElementRef,
    AfterContentInit,
    AfterViewInit,
    ViewContainerRef,
    Input,
    HostListener,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Session } from '../../../../controller/session/session';
import {
    IRange,
    EChartMode,
} from '../../../../controller/session/dependencies/timestamps/session.dependency.timestamps';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { scheme_color_2, getContrastColor } from '../../../../theme/colors';
import { DataService } from '../service.data';
import { fontString } from 'chart.js/helpers';
import { ChartEvent } from 'chart.js';

import TabsSessionsService from '../../../../services/service.sessions.tabs';
import EventsSessionService from '../../../../services/standalone/service.events.session';
import ViewsEventsService from '../../../../services/standalone/service.views.events';
import ContextMenuService from '../../../../services/standalone/service.contextmenu';
import OutputRedirectionsService, {
    EParent,
} from '../../../../services/standalone/service.output.redirections';
import Chart from 'chart.js/auto';

import * as Toolkit from 'chipmunk.client.toolkit';

enum EScrollingMode {
    scrollingY = 'scrollingY',
    scrollingX = 'scrollingX',
    zooming = 'zooming',
}

@Component({
    selector: 'app-views-measurement-chart',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ViewMeasurementChartComponent implements OnDestroy, AfterContentInit, AfterViewInit {
    @Input() service!: DataService;

    @ViewChild('canvas', { static: true }) _ng_canvas!: ElementRef<HTMLCanvasElement>;

    readonly CHART_UPDATE_DURATION: number = 60;
    readonly CHART_LEN_PX = 8;

    private _sizes: {
        container: {
            width: number;
            height: number;
        };
        charts: {
            height: number;
        };
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
    private _session: Session | undefined;
    private _destroy: boolean = false;
    private _chart: {
        instance?: Chart;
        update: number;
        timer: any;
    } = {
        instance: undefined,
        update: 0,
        timer: undefined,
    };
    private _cursor: {
        left: number;
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

    constructor(private _cdRef: ChangeDetectorRef, private _vcRef: ViewContainerRef) {
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

    public ngAfterContentInit() {}

    public ngAfterViewInit() {
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.update = this.service
            .getObservable()
            .update.subscribe(this._onChartDataUpdate.bind(this));
        this._subscriptions.change = this.service
            .getObservable()
            .change.subscribe(this._onChartDataChange.bind(this));
        this._subscriptions.zoom = this.service
            .getObservable()
            .zoom.subscribe(this._onChartDataZoom.bind(this));
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(
            this._resize.bind(this, false),
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
                caption: `Switch to: ${
                    this.service.getMode() === EChartMode.aligned ? 'scaled' : 'aligned'
                }`,
                handler: () => {
                    this.service.toggleMode();
                },
            },
        ];
        if (target !== undefined || this._session.getTimestamp().getCount() !== 0) {
            items.push({
                /* Delimiter */
            });
        }
        if (target !== undefined) {
            items.push(
                ...[
                    {
                        caption:
                            target === undefined
                                ? 'Remove this range'
                                : `Remove this range: ${target.range.start.position} - ${target.range.end?.position} / ${target.range.duration}`,
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
                ],
            );
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
            items.push(
                ...[
                    {
                        /* Delimiter */
                    },
                    {
                        caption: this.service.getOptimizationState()
                            ? `Do not optimize duration`
                            : `Optimize duration`,
                        handler: () => {
                            this.service.toggleOptimizationState();
                        },
                    },
                ],
            );
        }
        if (target !== undefined) {
            items.push(
                ...[
                    {
                        /* Delimiter */
                    },
                    {
                        caption: `Go to row: ${target.range.start.position}`,
                        handler: () => {
                            if (this._session === undefined) {
                                return;
                            }
                            OutputRedirectionsService.select(
                                EParent.timemeasurement,
                                this._session.getGuid(),
                                { output: target.range.start.position },
                            );
                        },
                    },
                    {
                        caption: `Go to row: ${target.range.end?.position}`,
                        handler: () => {
                            if (this._session === undefined) {
                                return;
                            }
                            target.range.end !== undefined &&
                                OutputRedirectionsService.select(
                                    EParent.timemeasurement,
                                    this._session.getGuid(),
                                    { output: target.range.end.position },
                                );
                        },
                    },
                ],
            );
        }
        if (this._session.getTimestamp().getCount() > 0) {
            items.push(
                ...[
                    {
                        /* Delimiter */
                    },
                    {
                        caption: `Export to CSV file`,
                        handler: () => {
                            if (this._session === undefined) {
                                return;
                            }
                            this.service.exportToCSV();
                        },
                    },
                ],
            );
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
            return '';
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
                    plugins: {
                        tooltip: {
                            enabled: false,
                        },
                        title: {
                            display: false,
                        },
                        legend: {
                            display: false,
                        },
                    },
                    responsive: false,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: {
                                offset: true,
                            },
                            min:
                                this.service.getMode() === EChartMode.aligned
                                    ? 0
                                    : this.service.getMinXAxe(),
                            max:
                                this.service.getMode() === EChartMode.aligned
                                    ? this.service.getMaxDuration()
                                    : this.service.getMaxXAxe(),
                            ticks: {
                                display: false,
                            },
                        },
                        y: {
                            min: 0,
                            max: data.maxY === undefined ? 0 : data.maxY + 1,
                            beginAtZero: true,
                            ticks: {
                                display: false,
                                stepSize: 1,
                                maxTicksLimit: 100,
                            },
                        },
                    },
                    animation: {
                        duration: 1,
                        onComplete: function () {
                            if (
                                self.service === undefined ||
                                self._chart === undefined ||
                                self._chart.instance === undefined
                            ) {
                                return;
                            }
                            const ctx = self._chart.instance.ctx;
                            ctx.font = fontString(
                                Chart.defaults.font.size,
                                Chart.defaults.font.style,
                                Chart.defaults.font.family,
                            );
                            ctx.textAlign = 'right';
                            ctx.textBaseline = 'top';
                            (this as any).data.datasets.forEach((dataset: any, i: number) => {
                                if (
                                    self._chart === undefined ||
                                    self._chart.instance === undefined
                                ) {
                                    return;
                                }
                                const rect = self._getBarRect(
                                    self._chart.instance.getDatasetMeta(i),
                                );
                                if (rect === undefined) {
                                    return;
                                }
                                const duration: number = dataset.data[1].duration;
                                const label: string = `${duration} ms`;
                                if (label.length * self.CHART_LEN_PX > rect.w) {
                                    return;
                                }
                                if (dataset.data[1].range === true) {
                                    ctx.font = fontString(
                                        Chart.defaults.font.size,
                                        Chart.defaults.font.style,
                                        Chart.defaults.font.family,
                                    );
                                    ctx.fillStyle = getContrastColor(dataset.borderColor, true);
                                } else {
                                    ctx.font = fontString(
                                        Chart.defaults.font.size === undefined
                                            ? 1
                                            : Chart.defaults.font.size * 0.8,
                                        Chart.defaults.font.style,
                                        Chart.defaults.font.family,
                                    );
                                    ctx.fillStyle = scheme_color_2;
                                }
                                ctx.fillText(
                                    `${duration} ms`,
                                    rect.x2 - 4,
                                    dataset.data[1].range === true ? rect.y1 + 3 : rect.y1 - 2,
                                );
                            });
                        },
                    },
                },
            });
        } else {
            this._chart.instance.data.datasets = data.datasets;
            (this._chart as any).instance.options.scales.x.min =
                this.service.getMode() === EChartMode.aligned ? 0 : this.service.getMinXAxe();
            (this._chart as any).instance.options.scales.x.max =
                this.service.getMode() === EChartMode.aligned
                    ? this.service.getMaxDuration()
                    : this.service.getMaxXAxe();
            (this._chart as any).instance.options.scales.y.max =
                data.maxY === undefined ? 0 : data.maxY + 1;
        }
        this._resize(true);
    }

    private _onChartClick(event: ChartEvent) {
        if (this._session === undefined || this.service === undefined) {
            return;
        }
        if (
            (this._chart as any).instance.data === undefined ||
            !((this._chart as any).instance.data.datasets instanceof Array)
        ) {
            return;
        }
        const target = this._getDatasetOnClick(event.native as MouseEvent);
        if (target === undefined) {
            return;
        }
        target.range.end !== undefined &&
            OutputRedirectionsService.select(EParent.notassigned, this._session.getGuid(), {
                output:
                    target.range.start.position < target.range.end.position
                        ? target.range.start.position
                        : target.range.end.position,
            });
    }

    private _getDatasetOnClick(event?: MouseEvent):
        | {
              range: IRange;
              x: number;
              y: number;
          }
        | undefined {
        if (event === undefined) {
            return undefined;
        }
        let match: any;
        (this._chart as any).instance.data.datasets.forEach((dataset: any, index: number) => {
            if (match !== undefined) {
                return;
            }
            if ((dataset as any).range === undefined) {
                // It might be distance range, which has to be ignored
                return;
            }
            const rect = this._getBarRect((this._chart as any).instance.getDatasetMeta(index));
            if (rect === undefined) {
                return;
            }
            if (
                event.offsetX >= rect.x1 &&
                event.offsetX <= rect.x2 &&
                event.offsetY >= rect.y1 &&
                event.offsetY <= rect.y2
            ) {
                match = {
                    range: (dataset as any).range,
                    x: event.clientX,
                    y: event.clientY,
                };
            }
        });
        return match;
    }

    private _getBarRect(
        meta: any,
    ): undefined | { x1: number; y1: number; x2: number; y2: number; w: number; h: number } {
        if (meta.data.length !== 2) {
            return undefined;
        }
        const y1 = meta.data[0].y - this.service.MAX_BAR_HEIGHT / 2;
        const y2 = meta.data[1].y + this.service.MAX_BAR_HEIGHT / 2;
        return {
            x1: meta.data[0].x,
            y1: y1,
            x2: meta.data[1].x,
            y2: y2,
            w: meta.data[1].x - meta.data[0].x,
            h: y2 - y1,
        };
    }

    private _onSessionChange(controller?: Session) {
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
        (this._chart as any).instance.options.scales.x.min = this.service.getMinXAxe();
        (this._chart as any).instance.options.scales.x.max = this.service.getMaxXAxe();
        this._chartResizeUpdate();
    }

    private _resize(force: boolean = false) {
        if (
            !force &&
            this._sizes.container.height !== 0 &&
            !isNaN(this._sizes.container.height) &&
            isFinite(this._sizes.container.height)
        ) {
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
        const duration: number =
            this.CHART_UPDATE_DURATION - Math.abs(Date.now() - this._chart.update);
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
