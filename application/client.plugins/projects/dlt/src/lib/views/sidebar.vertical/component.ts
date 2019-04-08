// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';
import { EHostEvents, EHostCommands } from '../../common/host.events';
import * as Toolkit from 'logviewer.client.toolkit';

export interface IEnvVar {
    key: string;
    value: string;
}

export enum EState {
    connected = 'connected',
    connecting = 'connecting',
    disconnected = 'disconnected',
    error = 'error'
}

@Component({
    selector: Toolkit.EViewsTypes.sidebarVertical,
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarVerticalComponent implements AfterViewInit, OnDestroy {
    @ViewChild('input_ip') _ng_input_ip: ElementRef;
    @ViewChild('input_port') _ng_input_port: ElementRef;

    @Input() public ipc: Toolkit.PluginIPC;
    @Input() public session: string;

    public _ng_state: EState = EState.disconnected;
    public _ng_bytes: number;
    public _ng_packets: number;
    public _ng_error: string;
    public _ng_addr: string;
    public _ng_port: number;
    private _subscription: any;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngOnDestroy() {
        if (this._subscription !== undefined) {
            this._subscription.destroy();
        }
    }

    ngAfterViewInit() {
        // Subscription to income events
        this._subscription = this.ipc.subscribeToHost((message: any) => {
            if (typeof message !== 'object' && message === null) {
                // Unexpected format of message
                return;
            }
            if (message.stream !== this.session) {
                // No definition of streamId
                return;
            }
            this._onIncomeMessage(message);
        });
    }

    private _onIncomeMessage(message: any) {
        if (typeof message.event === 'string') {
            // Process events
            return this._onIncomeEvent(message);
        }
    }

    private _onIncomeEvent(message: any) {
        switch (message.event) {
            case EHostEvents.connecting:
                this._ng_state = EState.connecting;
                break;
            case EHostEvents.connected:
                this._ng_state = EState.connected;
                this._ng_bytes = 0;
                this._ng_packets = 0;
                break;
            case EHostEvents.disconnected:
                this._ng_state = EState.disconnected;
                this._ng_bytes = 0;
                this._ng_packets = 0;
                break;
            case EHostEvents.stat:
                this._ng_bytes = message.bytes;
                this._ng_packets = message.packets;
                break;
            case EHostEvents.error:
                this._ng_state = EState.error;
                this._ng_error = message.error;
                break;
        }
        this._cdRef.detectChanges();
    }

    public _ng_onConnect() {
        if (this._ng_input_ip === undefined || this._ng_input_ip === null) {
            return;
        }
        if (this._ng_input_port === undefined || this._ng_input_port === null) {
            return;
        }
        const addr: string = (this._ng_input_ip.nativeElement.value as string);
        const port: number = parseInt((this._ng_input_port.nativeElement.value as string), 10);
        if (addr.trim() === '') {
            return;
        }
        if (port < 0) {
            return;
        }
        this._ng_state = EState.connecting;
        this._ng_addr = addr;
        this._ng_port = port;
        this._cdRef.detectChanges();
        this.ipc.requestToHost({
            streamId: this.session,
            command: EHostCommands.connect,
            ip: addr,
            port: port
        }, this.session).then((response) => {
            console.log(response);
        });
    }

    public _ng_onDisconnect() {
        if (this._ng_state !== EState.connected) {
            return;
        }
        this.ipc.requestToHost({
            streamId: this.session,
            command: EHostCommands.disconnect,
        }, this.session).then((response) => {
            console.log(response);
        });
    }

    public _ng_onCloseError() {
        if (this._ng_state !== EState.error) {
            return;
        }
        this._ng_state = EState.disconnected;
        this._cdRef.detectChanges();
    }

}
