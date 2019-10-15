import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Chart } from 'chart.js';
import * as Toolkit from 'logviewer.client.toolkit';
import { ServiceData, IRange } from '../service.data';
import { ServicePosition, IPositionChange } from '../service.position';
import ViewsEventsService from '../../../../services/standalone/service.views.events';

const CSettings = {
    rebuildDelay: 10,
    maxPostponedRebuilds: 50,
    redrawDelay: 10,
    maxPostponedRedraws: 50,
};

@Component({
    selector: 'app-views-chart-canvas',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewChartCanvasComponent implements AfterViewInit, OnDestroy {

    @Input() service: ServiceData;
    @Input() position: ServicePosition;

    public _ng_width: number = 100;
    public _ng_height: number = 100;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewChartCanvasComponent');
    private _destroyed: boolean = false;
    private _chart: Chart | undefined;
    private _rebuild: {
        timer: any,
        postponed: number,
    } = {
        timer: -1,
        postponed: 0,
    };
    private _redraw: {
        timer: any,
        postponed: number,
    } = {
        timer: -1,
        postponed: 0,
    };
    private _position: IPositionChange = {
        left: -1,
        width: -1,
        full: -1,
    };

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {

    }

    ngAfterViewInit() {
        // Data events
        this._subscriptions.onData = this.service.getObservable().onData.subscribe(this._onData.bind(this));
        // Position events
        this._subscriptions.onPosition = this.position.getObservable().onChange.subscribe(this._onPosition.bind(this));
        // Listen session changes event
        this._subscriptions.onViewResize = ViewsEventsService.getObservable().onResize.subscribe(this._onViewResize.bind(this));
        // Update size of canvas and containers
        this._resize();
        // Try to build chart
        this._build();
    }

    ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _resize(force: boolean = false) {
        const size: ClientRect = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        if (this._ng_width === size.width && this._ng_height === size.height) {
            return;
        }
        this._ng_width = size.width;
        this._ng_height = size.height;
        this._forceUpdate();
        clearTimeout(this._redraw.timer);
        if (!force && this._redraw.postponed < CSettings.maxPostponedRedraws) {
            this._redraw.postponed += 1;
            this._redraw.timer = setTimeout(this._resize.bind(this, true), CSettings.redrawDelay);
            return;
        }
        this._redraw.postponed = 0;
        this._redraw.timer = -1;
        if (this._chart !== undefined) {
            this._chart.resize();
        }
    }

    private _build(force: boolean = false) {
        clearTimeout(this._rebuild.timer);
        if (!force && this._rebuild.postponed < CSettings.maxPostponedRebuilds) {
            this._rebuild.postponed += 1;
            this._rebuild.timer = setTimeout(this._build.bind(this, true), CSettings.rebuildDelay);
            return;
        }
        this._rebuild.postponed = 0;
        this._rebuild.timer = -1;
        if (this.service === undefined) {
            return;
        }
        if (this._chart !== undefined) {
            this._chart.destroy();
        }
        const labels: string[] = this.service.getLabes(this._ng_width, this._getRange());
        const datasets: Array<{ [key: string]: any }> = this.service.getDatasets(this._ng_width, this._getRange());
        if (labels.length === 0 || datasets.length === 0) {
            this._chart = undefined;
            return;
        }
        this._chart = new Chart('view-chart-canvas', {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets,
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
                            beginAtZero: true,
                        },
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
    }

    private _getRange(): IRange | undefined {
        const size: number | undefined = this.service.getStreamSize();
        if (size === undefined) {
            return undefined;
        }
        if (this._position.left < 0 || this._position.width <= 0 || this._position.full <= 0) {
            return undefined;
        }
        const rate: number = this._position.full / size;
        if (rate > 1) {
            // TODO: add implementation of this case
        } else {
            const range: IRange = {
                begin: Math.floor(this._position.left / rate),
                end: Math.floor((this._position.left + this._position.width) / rate)
            };
            range.end = range.end >= size ? size - 1 : range.end;
            return range;
        }
    }

    private _onData() {
        this._build();
    }

    private _onPosition(position: IPositionChange) {
        this._position = position;
        this._build();
    }

    private _onViewResize() {
        this._resize();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
