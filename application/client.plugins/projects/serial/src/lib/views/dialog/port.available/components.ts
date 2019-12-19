// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, Input, AfterViewInit } from '@angular/core';
import { IPortInfo, IPortState } from '../../../common/interface.portinfo';
import { IOptions } from '../../../common/interface.options';
import { Logger } from 'chipmunk.client.toolkit';
import Chart from 'chart.js';
import { Observable, Subscription } from 'rxjs';
import { EHostEvents } from '../../../common/host.events';

interface IConnected {
    port: IPortInfo;
    options: IOptions;
    state: IPortState;
}

interface Irgb {
    red: number;
    green: number;
    blue: number;
    opacity: 1;
}

@Component({
    selector: 'lib-dia-port-available-com',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogAvailablePortComponent implements /*OnDestroy,*/ AfterViewInit {

    @Input() public port: IPortInfo;
    @Input() public observer: { event: Observable<any> };
    @Input() public connected: IConnected[];
    @Input() public spyState: { [key: string]: number };

    private _subscriptions: { [key: string]: Subscription } = {};
    private _canvas: HTMLCanvasElement;
    private _ctx: any;
    private _step = 10;
    private _before = 0;
    private _animation = 5000;
    private _read: number;
    private _chart: Chart;
    private _spark = Array<number>(this._step + 1).fill(0);
    private _logger: Logger = new Logger(`Plugin: serial: inj_output_bot:`);
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngAfterViewInit() {
        var ctx = document.getElementById('myChart') as HTMLCanvasElement;
        var g = ctx.getContext('2d');
        var myChart = new Chart(g, {
            type: 'bar',
            data: {
                labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
                datasets: [{
                    label: '# of Votes',
                    data: [12, 19, 3, 5, 2, 3],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
                        'rgba(255, 206, 86, 0.2)',
                        'rgba(75, 192, 192, 0.2)',
                        'rgba(153, 102, 255, 0.2)',
                        'rgba(255, 159, 64, 0.2)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero: true
                        }
                    }]
                }
            }
        });
    }
    //     if (!this._ng_isConnected(this.port)) {
    //         this._read = 0;
    //         this._canvas = document.getElementById(`canvas_${this.port.path}`) as HTMLCanvasElement;
    //         this._createChart().then(() => {
    //             this._update();
    //         }).catch((error: Error) => {
    //             this._logger.error(error.message);
    //         });
    //     }

    //     this._subscriptions.Subscription = this.observer.event.subscribe((message: any) => {
    //         if (typeof message !== 'object' && message === null) {
    //             return;
    //         }
    //         if (message.event === true) {
    //             this._update();
    //         }
    //         if (message.event === EHostEvents.spyState) {
    //             const diff = message.load[this.port.path] - this._before;
    //                 if (diff <= 0) {
    //                     this._read = 0;
    //                 } else {
    //                     this._read = diff;
    //                 }
    //                 this._before = message.load[this.port.path];
    //         }
    //     });
    // }

    // ngOnDestroy() {
    //     this._spark = [];
    //     this._chart.destroy();
    //     Object.keys(this._subscriptions).forEach((key: string) => {
    //         this._subscriptions[key].unsubscribe();
    //     });
    //     this._destroyed = true;
    // }

    // private _forceUpdate() {
    //     if (this._destroyed) {
    //         return;
    //     }
    //     this._cdRef.detectChanges();
    // }

    // private _formatLoad(load: number): string {
    //     let read: string = '';
    //     if (load > 1024 * 1024 * 1024) {
    //         read = (load / 1024 / 1024 / 1024).toFixed(2) + ' Gb';
    //     } else if (load > 1024 * 1024) {
    //         read = (load / 1024 / 1024).toFixed(2) + ' Mb';
    //     } else if (load > 1024) {
    //         read = (load / 1024).toFixed(2) + ' Kb';
    //     } else {
    //         read = load + ' b';
    //     }
    //     return read;
    // }

    // public _ng_isConnected(port: IPortInfo): IConnected {
    //     return this.connected.find(connected => connected.port.path === port.path);
    // }

    // public _ng_read(port: IPortInfo) {
    //     return this._formatLoad(this.spyState[port.path]);
    // }

    // private _color(): number {
    //     return Math.round(Math.random() * 255);
    // }

    // private _colorize(): string {
    //     const rgb: Irgb = {
    //         red: this._color(),
    //         green: this._color(),
    //         blue: this._color(),
    //         opacity: 1,
    //     };
    //     return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${rgb.opacity})`;
    // }

    // private _createChart(): Promise<void> {
    //     return new Promise((resolve, reject) => {
    //         this._ctx = this._canvas.getContext('2d');
    //         if (this._chart) {
    //             reject(`Chart for ${this.port.path} already exists!`);
    //         } else {
    //             this._chart = new Chart(this._ctx, {
    //                 type: 'line',
    //                 data: {
    //                     labels: new Array(this._step).fill(''),
    //                     datasets: [{
    //                         data: this._spark,
    //                         borderColor: this._colorize(),
    //                         pointRadius: 0,
    //                         fill: false,
    //                     }]
    //                 },
    //                 options: {
    //                     animation: {
    //                         duration: this._animation,
    //                     },
    //                     tooltips: {
    //                         displayColors: false
    //                     },
    //                     scales: {
    //                         xAxes: [{
    //                             ticks: {
    //                                 display: false,
    //                             },
    //                             gridLines: {
    //                                 drawOnChartArea: false
    //                             }
    //                         }],
    //                         yAxes: [{
    //                             display: false,
    //                             stacked: true,
    //                             ticks: {
    //                                 beginAtZero: true,
    //                             },
    //                             gridLines: {
    //                                 drawOnChartArea: false
    //                             }
    //                         }]
    //                     },
    //                     legend: {
    //                         display: false
    //                     }
    //                 }
    //             });
    //             resolve();
    //         }
    //     });
    // }

    // private _update() {
    //     // Check for subscription - popup main
    //     if (this._chart) {
    //         this._spark.shift();
    //         this._spark.push(this._read);
    //         this._chart.update();
    //         this._read = 0;
    //     }
    // }
}
