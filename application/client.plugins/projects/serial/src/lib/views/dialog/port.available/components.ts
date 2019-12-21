// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, Input, AfterViewInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { IPortInfo, IPortState } from '../../../common/interface.portinfo';
import { IOptions } from '../../../common/interface.options';
import { Logger } from 'chipmunk.client.toolkit';
import Chart from 'chart.js';
import { Observable, Subscription } from 'rxjs';
import Service from '../../../services/service';

interface IConnected {
    port: IPortInfo;
    options: IOptions;
    state: IPortState;
}

interface Irgb {
    red: number;
    green: number;
    blue: number;
    opacity: number;
}

@Component({
    selector: 'lib-dia-port-available-com',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogAvailablePortComponent implements OnDestroy, AfterViewInit {

    @Input() public port: IPortInfo;
    @Input() public observer: { event: Observable<any> };
    @Input() public connected: IConnected[];
    @Input() public spyState: { [key: string]: number };

    @ViewChildren('canvas') canvases: QueryList<ElementRef>;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _canvas: ElementRef;
    private _ctx: any;
    private _step = 10;
    private _animation = 5000;
    private _read: number;
    private _chart: Chart;
    private _spark = Array<number>(this._step + 1).fill(0);
    private _logger: Logger = new Logger(`Plugin: serial: inj_output_bot:`);
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngAfterViewInit() {
        if (!this._ng_isConnected(this.port)) {
            this._read = 0;
            this._canvas = this.canvases.find(canvas => canvas.nativeElement.id === `canvas_${this.port.path}`);
            this._createChart();
            this._update();
        }

        this._subscriptions.Subscription = this.observer.event.subscribe((message: any) => {
            if (typeof message !== 'object' && message === null) {
                return;
            }
            if (message) {
                this._update();
            }
        });

        this._subscriptions.Subscription = Service.getObservable().event.subscribe((message: any) => {
            if (message[this.port.path]) {
                    this._read = message[this.port.path];
            }
        });
    }

    ngOnDestroy() {
        this._spark = [];
        if (this._chart) {
            this._chart.destroy();
        }
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

    private _formatLoad(load: number): string {
        let read: string = '';
        if (load > 1024 * 1024 * 1024) {
            read = (load / 1024 / 1024 / 1024).toFixed(2) + ' Gb';
        } else if (load > 1024 * 1024) {
            read = (load / 1024 / 1024).toFixed(2) + ' Mb';
        } else if (load > 1024) {
            read = (load / 1024).toFixed(2) + ' Kb';
        } else {
            read = load + ' b';
        }
        return read;
    }

    public _ng_isConnected(port: IPortInfo): boolean {
        if (this.connected && this.connected.find(connected => connected.port.path === port.path)) {
            return true;
        }
        return false;
    }

    public _ng_read(port: IPortInfo) {
        return this._formatLoad(this.spyState[port.path]);
    }

    private _color(): number {
        return Math.round(Math.random() * 255);
    }

    private _colorize(): string {
        const rgb: Irgb = {
            red: this._color(),
            green: this._color(),
            blue: this._color(),
            opacity: 1,
        };
        return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${rgb.opacity})`;
    }

    private _createChart() {
        this._ctx = this._canvas.nativeElement.getContext('2d');
        this._chart = new Chart(this._ctx, {
            type: 'line',
            data: {
                labels: new Array(this._step).fill(''),
                datasets: [{
                    data: this._spark,
                    borderColor: this._colorize(),
                    pointRadius: 0,
                    fill: false,
                }]
            },
            options: {
                animation: {
                    duration: this._animation,
                },
                tooltips: {
                    displayColors: false
                },
                scales: {
                    xAxes: [{
                        ticks: {
                            display: false,
                        },
                        gridLines: {
                            drawOnChartArea: false
                        }
                    }],
                    yAxes: [{
                        display: false,
                        stacked: true,
                        ticks: {
                            beginAtZero: true,
                        },
                        gridLines: {
                            drawOnChartArea: false
                        }
                    }]
                },
                legend: {
                    display: false
                }
            }
        });
    }

    private _update() {
        if (this._chart) {
            this._spark.shift();
            this._spark.push(this._read);
            this._chart.update();
            this._read = 0;
        }
    }
}
