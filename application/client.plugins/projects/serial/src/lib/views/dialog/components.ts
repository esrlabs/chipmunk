// tslint:disable:no-inferrable-types

import { Component, ChangeDetectorRef, Input, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { IPortInfo, IPortState } from '../../common/interface.portinfo';
import { IOptions, CDefaultOptions } from '../../common/interface.options';
import { SidebarVerticalPortOptionsWriteComponent } from '../sidebar.vertical/port.options.write/component';
import Service from '../../services/service';
import { Subscription } from 'rxjs';

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

export class SidebarVerticalPortDialogComponent implements OnInit, OnDestroy {

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
            this._forceUpdate();
        });
        this._ng_spyState = this._getSpyState();
        this._ng_ports = this._requestPortList();
        this._ng_ports.forEach(port => {
            if (this._ng_spyState[port.path] === undefined ) {
                this._ng_spyState[port.path] = 0;
            }
        });
    }

    ngOnDestroy() {
        this._destroyed = true;
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
