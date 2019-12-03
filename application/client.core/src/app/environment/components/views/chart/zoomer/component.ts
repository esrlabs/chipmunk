import { Component, Input, Output, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef, EventEmitter } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Chart } from 'chart.js';
import * as Toolkit from 'chipmunk.client.toolkit';
import ViewsEventsService from '../../../../services/standalone/service.views.events';
import { ServiceData, IResults } from '../service.data';
import { ServicePosition } from '../service.position';

@Component({
    selector: 'app-views-chart-zoomer-canvas',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewChartZoomerCanvasComponent implements AfterViewInit, OnDestroy {

    @Input() serviceData: ServiceData;
    @Input() servicePosition: ServicePosition;

    public _ng_width: number = 100;
    public _ng_height: number = 100;
    public _ng_offset: number = 0;
    public _ng_onOffsetUpdated: EventEmitter<void> = new EventEmitter();
    public _ng_isCursorVisible: boolean = true;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewChartZoomerCanvasComponent');
    private _destroyed: boolean = false;
    private _filters: Chart | undefined;
    private _charts: Chart | undefined;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
        this._ng_getLeftOffset = this._ng_getLeftOffset.bind(this);
    }

    ngAfterViewInit() {
        // Data events
        this._subscriptions.onData = this.serviceData.getObservable().onData.subscribe(this._onData.bind(this));
        this._subscriptions.onCharts = this.serviceData.getObservable().onCharts.subscribe(this._onChartData.bind(this));
        // Listen session changes event
        this._subscriptions.onViewResize = ViewsEventsService.getObservable().onResize.subscribe(this._onViewResize.bind(this));
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
    }

    public _ng_getLeftOffset(): number {
        if (this._filters === undefined) {
            return 0;
        }
        return this._filters.chartArea.left;
    }

    private _resize(force: boolean = false) {
        const size: ClientRect = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        this._ng_width = size.width;
        this._ng_height = size.height;
        this._forceUpdate();
        if (this._filters !== undefined && (force || this._ng_offset === 0)) {
            this._filters.resize();
            this._ng_offset = this._filters.chartArea.left;
            this._ng_onOffsetUpdated.emit();
        }
        if (this._charts !== undefined && force) {
            this._charts.resize();
        }
    }

    private _build() {
        if (this.serviceData === undefined) {
            return;
        }
        if (this._ng_width < this.serviceData.getStreamSize()) {
            this._ng_isCursorVisible = true;
        } else {
            this._ng_isCursorVisible = false;
        }
        this._buildFilters();
        this._buildCharts();
        this._ng_onOffsetUpdated.emit();
    }

    private _buildFilters() {
        let width: number = 0;
        if (this._ng_width < this.serviceData.getStreamSize()) {
            width = Math.round(this._ng_width / 2);
        } else {
            width = this._ng_width;
        }
        const labels: string[] = this.serviceData.getLabes(width);
        const datasets: IResults = this.serviceData.getDatasets(width, undefined);
        if (labels.length === 0 || datasets.dataset.length === 0) {
            if (this._filters !== undefined) {
                this._filters.destroy();
                this._filters = undefined;
            }
            return;
        }
        if (this._filters === undefined) {
            this._filters = new Chart('view-chart-zoomer-filters-canvas', {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: datasets.dataset,
                },
                options: {
                    title: {
                        display: false,
                    },
                    legend: {
                        display: false,
                    },
                    animation: {
                        duration: 0,
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        yAxes: [{
                            stacked: true,
                            ticks: {
                                beginAtZero: true
                            },
                            display: false,
                        }],
                        xAxes: [{
                            stacked: true,
                            display: false,
                        }]
                    }
                }
            });
        } else {
            this._filters.data.labels = labels;
            this._filters.data.datasets = datasets.dataset;
            setTimeout(() => {
                this._filters.update();
            });
        }
    }

    private _buildCharts() {
        const datasets: IResults = this.serviceData.getChartsDatasets(this._ng_width, undefined, true);
        if (this._charts === undefined) {
            this._charts = new Chart('view-chart-zoomer-charts-canvas', {
                type: 'scatter',
                data: {
                    datasets: datasets.dataset,
                },
                options: {
                    title: {
                        display: false,
                    },
                    legend: {
                        display: false,
                    },
                    animation: {
                        duration: 0,
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        xAxes: [{
                            ticks: {
                                min: 0,
                                max: this.serviceData.getStreamSize(),
                            },
                            gridLines: {
                                color: '#888',
                                drawOnChartArea: false
                            },
                           display: false
                        }],
                        yAxes: [{
                            display: false,
                            ticks: {
                                beginAtZero: true,
                                max: Math.round(datasets.max + datasets.max * 0.1)
                            },
                        }]
                     }
                }
            });
            this._forceUpdate();
        } else {
            this._charts.data.datasets = datasets.dataset;
            setTimeout(() => {
                this._charts.update();
            });
        }
    }

    private _onData() {
        this._buildFilters();
    }

    private _onChartData() {
        this._buildCharts();
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
