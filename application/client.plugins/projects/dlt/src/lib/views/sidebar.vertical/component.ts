// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';
import { EHostEvents, EHostCommands } from '../../common/host.events';
import * as Toolkit from 'chipmunk.client.toolkit';
import { InputStandardComponent } from 'chipmunk-client-material';

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
    @ViewChild('input_ip', {static: false}) _ng_input_ip: InputStandardComponent;
    @ViewChild('input_port', {static: false}) _ng_input_port: InputStandardComponent;

    @Input() public api: Toolkit.IAPI;
    @Input() public session: string;

    public _ng_state: EState = EState.disconnected;
    public _ng_bytes: number;
    public _ng_packets: number;
    public _ng_error: string;
    public _ng_addr: string | undefined;
    public _ng_port: number | undefined;
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
        this._subscription = this.api.getIPC().subscribe((message: any) => {
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

    public _ng_onIPValidate(value: string): string | undefined {
        if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/gi.exec(value) === null) {
            this._ng_addr = undefined;
            return `IP address isn't valid`;
        }
        return undefined;
    }

    public _ng_onPortValidate(value: string): string | undefined {
        if (/\d{1,6}/gi.exec(value) === null) {
            this._ng_port = undefined;
            return `Port isn't valid`;
        }
        const numeric: number = parseInt(value, 10);
        if (isNaN(numeric) || !isFinite(numeric)) {
            this._ng_port = undefined;
            return `Port isn't valid`;
        }
        return undefined;
    }

    public _ng_onIPChange(value: string) {
        this._ng_addr = value;
    }

    public _ng_onPortChange(value: string) {
        this._ng_port = parseInt(value, 10);
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
        if (this._ng_addr === undefined || this._ng_port === undefined) {
            return;
        }
        this._ng_state = EState.connecting;
        this._cdRef.detectChanges();
        this.api.getIPC().request({
            streamId: this.session,
            command: EHostCommands.connect,
            ip: this._ng_addr,
            port: this._ng_port,
        }, this.session).then((response) => {
            // TODO: what to do here?
        });
    }

    public _ng_onDisconnect() {
        if (this._ng_state !== EState.connected) {
            return;
        }
        this.api.getIPC().request({
            streamId: this.session,
            command: EHostCommands.disconnect,
        }, this.session).then((response) => {
            // TODO: what to do here?
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
