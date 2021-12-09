import {
    Component,
    Input,
    AfterViewInit,
    OnDestroy,
    ChangeDetectorRef,
    ViewContainerRef,
    EventEmitter,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ServiceData, IResults, IChartsResults, IScaleState, EScaleType } from '../service.data';
import { ServicePosition } from '../service.position';

import ViewsEventsService from '../../../../services/standalone/service.views.events';
import Chart from 'chart.js/auto';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-chart-zoomer-canvas',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ViewChartZoomerCanvasComponent implements AfterViewInit, OnDestroy {
    @Input() serviceData!: ServiceData;
    @Input() servicePosition!: ServicePosition;

    public _ng_width: number = 100;
    public _ng_height: number = 100;
    public _ng_onOffsetUpdated: EventEmitter<void> = new EventEmitter();
    public _ng_isCursorVisible: boolean = true;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewChartZoomerCanvasComponent');
    private _destroyed: boolean = false;
    private _filters: Chart | undefined;
    private _charts: Chart | undefined;
    private _timeout: number | undefined;

    constructor(private _cdRef: ChangeDetectorRef, private _vcRef: ViewContainerRef) {
        this._ng_getLeftOffset = this._ng_getLeftOffset.bind(this);
    }

    ngAfterViewInit() {
        // Data events
        this._subscriptions.onData = this.serviceData
            .getObservable()
            .onData.subscribe(this._onData.bind(this));
        this._subscriptions.onCharts = this.serviceData
            .getObservable()
            .onCharts.subscribe(this._onChartData.bind(this));
        this._subscriptions.onChartsScaleType = this.serviceData
            .getObservable()
            .onChartsScaleType.subscribe(this._onChartsScaleType.bind(this));
        // Listen session changes event
        this._subscriptions.onViewResize = ViewsEventsService.getObservable().onResize.subscribe(
            this._onViewResize.bind(this),
        );
        // Update size of canvas and containers
        this._resize(true);
        // Try to build chart
        this._build();
    }

    ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        if (this._charts !== undefined) {
            this._charts.destroy();
            this._charts = undefined;
        }
        if (this._filters !== undefined) {
            this._filters.destroy();
            this._filters = undefined;
        }
    }

    public _ng_getLeftOffset(): number {
        if (this._filters === undefined) {
            return 0;
        }
        return this._filters.chartArea.left;
    }

    private _resize(force: boolean = false) {
        if (this._destroyed) {
            return;
        }
        const size: DOMRect = (
            this._vcRef.element.nativeElement as HTMLElement
        ).getBoundingClientRect();
        this._ng_width = size.width;
        this._ng_height = size.height;
        if (!this._updateCursor()) {
            this._forceUpdate();
        }
        if (this._filters !== undefined && force) {
            this._filters.resize();
            this._ng_onOffsetUpdated.emit();
        }
        if (this._charts !== undefined && force) {
            this._charts.resize();
        }
        clearTimeout(this._timeout);
        this._timeout = window.setTimeout(() => {
            if (this._charts !== undefined) {
                this._charts.update();
            }
            if (this._filters !== undefined) {
                this._filters.update();
            }
        }, 200);
    }

    private _build() {
        if (this.serviceData === undefined) {
            return;
        }
        this._updateCursor();
        this._buildFilters();
        this._buildCharts();
        this._ng_onOffsetUpdated.emit();
    }

    private _updateCursor(): boolean {
        const prev: boolean = this._ng_isCursorVisible;
        const streamSize: number | undefined = this.serviceData.getStreamSize();
        if (streamSize === undefined || !this.serviceData.hasData()) {
            this._ng_isCursorVisible = false;
        } else if (this._ng_width < streamSize) {
            this._ng_isCursorVisible = true;
        } else {
            this._ng_isCursorVisible = false;
        }
        if (this._ng_isCursorVisible !== prev) {
            this._forceUpdate();
            return true;
        }
        return false;
    }

    private _buildFilters() {
        let width: number = 0;
        const stream_size = this.serviceData.getStreamSize();
        if (stream_size === undefined) {
            this._logger.error(`Unknown stream size`);
            return;
        }
        if (this._ng_width < stream_size) {
            width = Math.round(this._ng_width / 2);
        } else {
            width = this._ng_width;
        }
        this.serviceData.getDatasets(width, undefined).then((datasets: IResults) => {
            const labels: string[] = this.serviceData.getLabes(width);
            if (labels.length === 0 || datasets.dataset.length === 0) {
                if (this._filters !== undefined) {
                    this._filters.destroy();
                    this._filters = undefined;
                }
                return;
            }
            if (
                this._filters !== undefined &&
                (this._filters.data.datasets === undefined ||
                    this._filters.data.datasets.length === 0)
            ) {
                this._filters.destroy();
                this._filters = undefined;
            }
            if (this._filters === undefined) {
                this._filters = new Chart(
                    `view-chart-zoomer-filters-canvas-${this.serviceData.getSessionGuid()}`,
                    {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: datasets.dataset,
                        },
                        options: {
                            plugins: {
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
                                y: {
                                    stacked: true,
                                    beginAtZero: true,
                                    display: false,
                                },
                                x: {
                                    stacked: true,
                                    display: false,
                                },
                            },
                        },
                    },
                );
            } else {
                this._filters.data.labels = labels;
                this._filters.data.datasets = datasets.dataset;
                setTimeout(() => {
                    if (this._destroyed) {
                        return;
                    }
                    if (this._filters === undefined) {
                        return;
                    }
                    this._filters.update();
                });
            }
        });
    }

    private _buildCharts() {
        const datasets: IChartsResults = this.serviceData.getChartsDatasets(
            this._ng_width,
            undefined,
            true,
        );
        if (
            this._charts !== undefined &&
            (this._charts.data.datasets === undefined || this._charts.data.datasets.length === 0)
        ) {
            this._charts.destroy();
            this._charts = undefined;
        }
        if (this._charts === undefined) {
            this._charts = new Chart(
                `view-chart-zoomer-charts-canvas-${this.serviceData.getSessionGuid()}`,
                {
                    type: 'scatter',
                    data: {
                        datasets: datasets.dataset,
                    },
                    options: {
                        plugins: {
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
                                min: 0,
                                max: this.serviceData.getStreamSize(),
                                grid: {
                                    color: '#888',
                                    drawOnChartArea: false,
                                },
                                display: false,
                            },
                        },
                    },
                },
            );
            this._setYAxes(datasets.scale);
            this._forceUpdate();
        } else {
            this._charts.data.datasets = datasets.dataset;
            this._setYAxes(datasets.scale);
            (this._charts as any).options.scales.x.max = this.serviceData.getStreamSize();
            setTimeout(() => {
                if (this._destroyed) {
                    return;
                }
                if (this._charts === undefined) {
                    return;
                }
                this._charts.update();
            });
        }
    }

    private _setYAxes(scale: IScaleState) {
        if (
            this._charts === undefined ||
            this._charts.options === undefined ||
            this._charts.options.scales === undefined
        ) {
            return;
        }
        if (scale.yAxisIDs.length === 0) {
            this._charts.options.scales['y'] = {
                display: false,
            };
            return;
        }
        scale.yAxisIDs.forEach((yAxisID: string, i: number) => {
            let min: number = 0;
            let max: number = 100;
            switch (this.serviceData.getScaleType()) {
                case EScaleType.single:
                    min = scale.min[i];
                    max = scale.max[i];
                    break;
                case EScaleType.common:
                    min = Math.min(...scale.min);
                    max = Math.max(...scale.max);
                    break;
            }
            if (
                this._charts === undefined ||
                this._charts.options === undefined ||
                this._charts.options.scales === undefined
            ) {
                return;
            }
            this._charts.options.scales[yAxisID] = {
                display: false,
                position: 'left',
                min: min === undefined ? undefined : this._prepMin(min),
                max: max === undefined ? undefined : this._prepMax(max),
            };
        });
        this._charts.update();
    }

    private _prepMin(min: number): number {
        if (Number.isInteger(min)) {
            return Math.floor(min);
        }
        return min;
    }

    private _prepMax(max: number): number {
        if (Number.isInteger(max)) {
            return Math.ceil(max + max * 0.02);
        }
        return max + max * 0.02;
    }

    private _onData() {
        this._updateCursor();
        this._buildFilters();
    }

    private _onChartData() {
        this._updateCursor();
        this._buildCharts();
    }

    private _onChartsScaleType(scale: EScaleType) {
        if (this._charts === undefined) {
            return;
        }
        this._setYAxes(this.serviceData.getScaleState());
        setTimeout(() => {
            if (this._destroyed) {
                return;
            }
            if (this._charts === undefined) {
                return;
            }
            this._charts.update();
        });
    }

    private _onViewResize() {
        this._resize(false);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
