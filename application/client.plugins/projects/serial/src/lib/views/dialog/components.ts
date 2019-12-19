// tslint:disable:no-inferrable-types

import { Component, ChangeDetectorRef, Input, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { IPortInfo, IPortState } from '../../common/interface.portinfo';
import { IOptions, CDefaultOptions } from '../../common/interface.options';
import { SidebarVerticalPortOptionsWriteComponent } from '../sidebar.vertical/port.options.write/component';
import { EHostEvents } from '../../common/host.events';
import { Logger } from 'chipmunk.client.toolkit';
import { Subscription } from 'rxjs';
import Service from '../../services/service';
import Chart from 'chart.js';

interface Irgb {
    red: number;
    green: number;
    blue: number;
    opacity: 1;
}

interface IConnected {
    port: IPortInfo;
    options: IOptions;
    state: IPortState;
}

@Component({
    selector: 'lib-sb-port-dialog-com',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarVerticalPortDialogComponent implements OnInit, OnDestroy, AfterViewInit {

    @ViewChild('optionsCom', {static: false}) _optionsCom: SidebarVerticalPortOptionsWriteComponent;

    @Input() public _onConnect: () => void;
    @Input() public _requestPortList: () => IPortInfo[];
    @Input() public _getSelected: (IPortInfo) => void;
    @Input() public _getOptionsCom: (SidebarVerticalPortOptionsWriteComponent) => void;
    @Input() public _getSpyState: () => { [key: string]: number };

    @Input() public _ng_canBeConnected: () => boolean;
    @Input() public _ng_connected: IConnected[];
    @Input() public _ng_onOptions: () => void;
    @Input() public _ng_onPortSelect: (port: IPortInfo) => void;

    private _canvas: HTMLCanvasElement;
    private _ctx: any;
    private _interval: any;
    private _step = 10;
    private _timeout = 1000;
    private _animation = 5000;
    private _portRead: { [port: string]: number } = {};
    private _portSpark: { [port: string]: Array<number> } = {};
    private _portChart: { [port: string]: Chart } = {};
    private _portBefore: { [port: string]: number } = {};
    private _logger: Logger = new Logger(`Plugin: serial: inj_output_bot:`);
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    public _ng_ports: IPortInfo[] = [];
    public _ng_selected: IPortInfo | undefined;
    public _ng_busy: boolean = false;
    public _ng_error: string | undefined;
    public _ng_options: boolean = false;
    public _ng_spyState: { [key: string]: number };

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngOnInit() {
        this._subscriptions.Subscription = Service.getObservable().event.subscribe((message: any) => {
            if (typeof message !== 'object' && message === null) {
                return;
            }
            if (message.event === EHostEvents.spyState) {
                Object.keys(message.load).forEach((port: string) => {
                    if (this._portSpark[port] === undefined) {
                        this._portSpark[port] = new Array(this._step + 1).fill(0);
                    }
                    const diff = message.load[port] - this._portBefore[port];
                    if (diff <= 0) {
                        this._portRead[port] = 0;
                    } else {
                        this._portRead[port] = diff;
                    }
                    this._portBefore[port] = message.load[port];
                });
            }
            this._forceUpdate();
        });
        this._ng_spyState = this._getSpyState();
        this._ng_ports = this._requestPortList();
        this._ng_ports.forEach(port => {
            this._portSpark[port.path] = new Array(this._step + 1).fill(0);
            this._portBefore[port.path] = 0;
            if (this._ng_spyState[port.path] === undefined) {
                this._ng_spyState[port.path] = 0;
            }
        });
    }

    ngAfterViewInit() {
        const promises: Promise<void>[] = [];
        this._ng_ports.forEach((port) => {
            if (!this._ng_isConnected(port)) {
                this._portRead[port.path] = 0;
                this._canvas = document.getElementById(`canvas_${port.path}`) as HTMLCanvasElement;
                promises.push(this._createChart(port.path));
            }
        });
        Promise.all(promises).then(() => {
            this._update();
        }).catch((error: Error) => {
            this._logger.error(error.message);
        });
    }

    ngOnDestroy() {
        Object.keys(this._portChart).forEach((port) => {
            this._portSpark[port] = [];
            if (this._portChart[port]) {
                this._portChart[port].destroy();
            }
        });
        if (this._interval) {
            clearTimeout(this._interval);
        }
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
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

    private _createChart(port: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this._ctx = this._canvas.getContext('2d');
            if (this._portChart[port]) {
                reject('Chart for this port already exists!');
            } else {
                this._portChart[port] = new Chart(this._ctx, {
                    type: 'line',
                    data: {
                        labels: new Array(this._step).fill(''),
                        datasets: [{
                            data: this._portSpark[port],
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
                resolve();
            }
        });
    }

    private _update() {
        if (Object.keys(this._portChart).length > 0) {
            this._interval = setInterval(() => {
                Object.keys(this._portChart).forEach((port: string) => {
                    this._portSpark[port].shift();
                    this._portSpark[port].push(this._portRead[port]);
                    this._portChart[port].update();
                    this._portRead[port] = 0;
                });
            }, this._timeout);
        }
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

    private _getOptions(): IOptions {
        let options: IOptions = Object.assign({}, CDefaultOptions);
        if (this._optionsCom && this._optionsCom !== null) {
            options = this._optionsCom.getOptions();
        }
        options.path = this._ng_selected.path;
        return options;
    }

    public _ng_isConnected(port: IPortInfo): IConnected {
        return this._ng_connected.find(connected => connected.port.path === port.path);
    }

    public _ng_onConnect() {
        this._getSelected(this._ng_selected);
        this._getOptionsCom(this._getOptions());
        this._onConnect();
    }

    public _ng_isPortSelected(port: IPortInfo): boolean {
        if (this._ng_selected === undefined) {
            return false;
        }
        return this._ng_selected.path === port.path ? true : false;
    }

    public _ng_getState(port: IPortInfo): IPortState {
        const target: IConnected | undefined = this._ng_connected.find((connected: IConnected) => {
            return connected.port.path === port.path;
        });
        if (target === undefined) {
            return {
                connections: 0,
                ioState: { written: 0, read: 0 }
            };
        } else {
            return target.state;
        }
    }

    public _ng_formatLoad(load: number): string {
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
}
