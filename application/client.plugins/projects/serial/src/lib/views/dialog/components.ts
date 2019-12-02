// tslint:disable:no-inferrable-types

import { Component, ChangeDetectorRef, Input, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { IPortInfo, IPortState } from '../../common/interface.portinfo';
import { IOptions } from '../../common/interface.options';
import { SidebarVerticalPortOptionsWriteComponent } from '../sidebar.vertical/port.options.write/component';

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
    @Input() public _stopSpy: () => void;
    @Input() public _getSpyState: () => { [key: string]: number };

    @Input() public _ng_getState: (IPortInfo) => IPortState;
    @Input() public _ng_canBeConnected: () => boolean;
    @Input() public _ng_connected: IConnected[];
    @Input() public _ng_isPortSelected: (port: IPortInfo) => boolean;
    @Input() public _ng_onOptions: () => void;
    @Input() public _ng_onPortSelect: (port: IPortInfo) => void;

    private interval: any;

    public _ng_ports: IPortInfo[] = [];
    public _ng_selected: IPortInfo | undefined;
    public _ng_busy: boolean = false;
    public _ng_error: string | undefined;
    public _ng_options: boolean = false;
    public _ng_spyState: { [key: string]: number };

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngOnInit() {
        this._ng_spyState = this._getSpyState();
        this._ng_ports = this._requestPortList();
        this._ng_ports.forEach(port => {
            if (this._ng_spyState[port.comName] === undefined ) {
                this._ng_spyState[port.comName] = 0;
            }
        });
        this.interval = setInterval(() => {
            this._cdRef.detectChanges();
        }, 200);
    }

    ngOnDestroy() {
        clearInterval(this.interval);
        this._stopSpy();
    }

    public _ng_onConnect() {
        this._getSelected(this._ng_selected);
        this._getOptionsCom(this._optionsCom);
        this._onConnect();
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
