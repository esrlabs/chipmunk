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
} from '@angular/core';
import { Subscription } from 'rxjs';
import { DataService, EChartMode } from '../service.data';

import ViewsEventsService from '../../../../services/standalone/service.views.events';
import Chart from 'chart.js/auto';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-measurement-overview',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ViewMeasurementOverviewComponent
    implements OnDestroy, AfterContentInit, AfterViewInit
{
    @Input() service!: DataService;

    @ViewChild('canvas', { static: true }) _ng_canvas!: ElementRef<HTMLCanvasElement>;

    readonly CHART_UPDATE_DURATION: number = 60;

    public _ng_mode: EChartMode = EChartMode.aligned;

    private _heights: {
        container: number;
        charts: number;
    } = {
        container: 0,
        charts: 0,
    };
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementOverviewComponent');
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

    constructor(private _cdRef: ChangeDetectorRef, private _vcRef: ViewContainerRef) {}

    public ngOnDestroy() {
        this._destroy = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        if (this._chart.instance !== undefined) {
            this._chart.instance.destroy();
            this._chart.instance = undefined;
        }
    }

    public ngAfterContentInit() {}

    public ngAfterViewInit() {
        this._subscriptions.update = this.service
            .getObservable()
            .update.subscribe(this._onChartDataUpdate.bind(this));
        this._subscriptions.change = this.service
            .getObservable()
            .change.subscribe(this._onChartDataChange.bind(this));
        this._subscriptions.mode = this.service
            .getObservable()
            .mode.subscribe(this._setChartMode.bind(this));
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(
            this._resize.bind(this),
        );
        this._setChartMode();
        this._build();
    }

    private _build() {
        if (this._ng_canvas === undefined || this.service === undefined) {
            return;
        }
        const data = this.service.getChartDataset(true);
        if (this._chart.instance === undefined) {
            this._chart.instance = new Chart(this._ng_canvas.nativeElement, {
                type: 'scatter',
                data: {
                    datasets: data.datasets,
                },
                options: {
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
                    animation: false,
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: {
                                display: false,
                            },
                            min: this.service.getMinXAxe(false),
                            max: this.service.getMaxXAxe(false),
                            ticks: {
                                display: false,
                            },
                        },
                        y: {
                            grid: {
                                display: false,
                            },
                            min: 0,
                            max: (data.maxY === undefined ? 0 : data.maxY) + 1,
                            beginAtZero: true,
                            ticks: {
                                display: false,
                                stepSize: 1,
                                maxTicksLimit: 100,
                            },
                        },
                    },
                },
            });
        } else {
            this._chart.instance.data.datasets = data.datasets;
            (this._chart as any).instance.options.scales.x.min = this.service.getMinXAxe(false);
            (this._chart as any).instance.options.scales.x.max = this.service.getMaxXAxe(false);
            (this._chart as any).instance.options.scales.y.max =
                (data.maxY === undefined ? 0 : data.maxY) + 1;
        }
        this._resize();
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

    private _setChartMode() {
        this._ng_mode = this.service.getMode();
        this._forceUpdate();
    }

    private _resize() {
        this._heights.container = (
            this._vcRef.element.nativeElement as HTMLElement
        ).getBoundingClientRect().height;
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

    private _forceUpdate() {
        if (this._destroy) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
