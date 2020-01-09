// tslint:disable:no-inferrable-types

import { Component, ChangeDetectorRef, Input, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { IPortInfo, IPortState } from '../../common/interface.portinfo';
import { IOptions, CDefaultOptions } from '../../common/interface.options';
import { SidebarVerticalPortOptionsWriteComponent } from '../sidebar.vertical/port.options.write/component';
import { Subscription, Subject, Observable } from 'rxjs';
import Service from '../../services/service';
import * as Toolkit from 'chipmunk.client.toolkit';
import { ENotificationType } from 'chipmunk.client.toolkit';

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
    @Input() public _requestPortList: () => Promise<IPortInfo[]>;
    @Input() public _getSelected: (IPortInfo) => void;
    @Input() public _getOptionsCom: (SidebarVerticalPortOptionsWriteComponent) => void;
    @Input() public _getPortOptions: () => IOptions[];
    @Input() public _setPortOptions: (options: IOptions[]) => void;
    @Input() public _ng_canBeConnected: () => boolean;
    @Input() public _ng_connected: IConnected[];
    @Input() public _ng_onOptions: () => void;
    @Input() public _ng_onPortSelect: (port: IPortInfo) => void;
    @Input() public _ng_recent: boolean;

    private _interval: any;
    private _timeout = 1000;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;
    private _subjects = { tick: new Subject<boolean>() };
    private _logger: Toolkit.Logger = new Toolkit.Logger(`Plugin: serial: inj_output_bot:`);

    public _ng_ports: IPortInfo[] = [];
    public _ng_selected: IPortInfo | undefined;
    public _ng_busy: boolean = false;
    public _ng_error: string | undefined;
    public _ng_options: boolean = false;
    public _ng_spyState: { [key: string]: number } = {};

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngOnInit() {
        this._subscriptions.Subscription = Service.getObservable().event.subscribe((message: any) => {
            if (typeof message !== 'object' || message === null) {
                return;
            }
            this._onSpyState(message);
            this._forceUpdate();
        });
        this._refreshPortList();
    }

    ngAfterViewInit() {
        this._next();
    }

    ngOnDestroy() {
        clearTimeout(this._interval);
        this._stopSpy();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }

    private _refreshPortList() {
        this._requestPortList().then((response: IPortInfo[]) => {
            this._ng_ports = response;
            this._ng_ports.forEach(port => {
                if (this._ng_spyState[port.path] === undefined) {
                    this._ng_spyState[port.path] = 0;
                }
            });
            this._forceUpdate();
        }).catch((error: Error) => {
            Service.notify('Error', `Failed to load port list due to error: ${error.message}`, ENotificationType.error);
        });
    }

    public onTick(): { tick: Observable<boolean> } {
        return { tick: this._subjects.tick.asObservable() };
    }

    private _next() {
        clearTimeout(this._interval);
        this._subjects.tick.next(true);
        this._interval = setTimeout(this._next.bind(this), this._timeout);
    }

    private _onSpyState(msg: {[key: string]: number}) {
        Object.keys(msg).forEach((port: string) => {
            if (this._ng_spyState[port]) {
                this._ng_spyState[port] += msg[port];
            } else {
                this._ng_spyState[port] = msg[port];
            }
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

    private _stopSpy() {
        Service.stopSpy(this._getPortOptions()).then(() => {
            this._setPortOptions([]);
        });
    }

    private _getOptions(): IOptions {
        let options: IOptions = Object.assign({}, CDefaultOptions);
        if (this._optionsCom && this._optionsCom !== null) {
            options = this._optionsCom.getOptions();
        }
        options.path = this._ng_selected.path;
        return options;
    }

    public _ng_onConnect(port?: IPortInfo) {
        if (port) {
            this._ng_selected = port;
        }
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

    public _ng_onRemovePort(port: string) {
        Service.removeConfig(port).then(() => {
            this._refreshPortList();
        }).catch((error: Error) => {
            Service.notify('Error', `Failed to remove all recent ports due to error: ${error.message}`, ENotificationType.error);
        });
    }
}
