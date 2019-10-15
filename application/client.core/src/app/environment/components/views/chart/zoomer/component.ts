import { Component, Input, Output, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef, EventEmitter } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Chart } from 'chart.js';
import * as Toolkit from 'logviewer.client.toolkit';
import ViewsEventsService from '../../../../services/standalone/service.views.events';
import { ServiceData } from '../service.data';
import { IPositionChange } from '../service.position';

@Component({
    selector: 'app-views-chart-zoomer-canvas',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewChartZoomerCanvasComponent implements AfterViewInit, OnDestroy {

    @Input() service: ServiceData;
    @Output() OnPositionChange = new EventEmitter<IPositionChange>();

    public _ng_width: number = 100;
    public _ng_height: number = 100;
    public _ng_offset: number = 0;
    public _ng_onOffsetUpdated: EventEmitter<void> = new EventEmitter();

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewChartZoomerCanvasComponent');
    private _destroyed: boolean = false;
    private _chart: Chart | undefined;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
        this._ng_getLeftOffset = this._ng_getLeftOffset.bind(this);
    }

    ngAfterViewInit() {
        // Data events
        this._subscriptions.onData = this.service.getObservable().onData.subscribe(this._onData.bind(this));
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

    public _ng_onPositionChange(event: IPositionChange) {
        this.OnPositionChange.emit(event);
    }

    public _ng_getLeftOffset(): number {
        if (this._chart === undefined) {
            return 0;
        }
        return this._chart.chartArea.left;
    }

    private _resize(force: boolean = false) {
        const size: ClientRect = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        this._ng_width = size.width;
        this._ng_height = size.height;
        this._forceUpdate();
        if (this._chart !== undefined && (force || this._ng_offset === 0)) {
            this._chart.resize();
            this._ng_offset = this._chart.chartArea.left;
            this._ng_onOffsetUpdated.emit();
        }
    }

    private _build() {
        if (this.service === undefined) {
            return;
        }
        if (this._chart !== undefined) {
            this._chart.destroy();
        }
        const labels: string[] = this.service.getLabes(Math.round(this._ng_width / 2));
        const datasets: Array<{ [key: string]: any }> = this.service.getDatasets(Math.round(this._ng_width / 2));
        if (labels.length === 0 || datasets.length === 0) {
            this._chart = undefined;
            return;
        }
        this._chart = new Chart('view-chart-zoomer-canvas', {
            type: 'bar',
            data: {
                labels: this.service.getLabes(Math.round(this._ng_width / 2)),
                datasets: this.service.getDatasets(Math.round(this._ng_width / 2)),
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
                        }
                    }],
                    xAxes: [{
                        stacked: true,
                        categoryPercentage: 1.0,
                        barPercentage: 1.0,
                        display: false,
                    }]
                }
            }
        });
        this._ng_onOffsetUpdated.emit();
    }

    private _onData() {
        this._build();
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
