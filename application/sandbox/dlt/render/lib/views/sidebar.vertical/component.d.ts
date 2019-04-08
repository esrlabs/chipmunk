import { OnDestroy, ChangeDetectorRef, AfterViewInit, ElementRef } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
export interface IEnvVar {
    key: string;
    value: string;
}
export declare enum EState {
    connected = "connected",
    connecting = "connecting",
    disconnected = "disconnected",
    error = "error"
}
export declare class SidebarVerticalComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    _ng_input_ip: ElementRef;
    _ng_input_port: ElementRef;
    ipc: Toolkit.PluginIPC;
    session: string;
    _ng_state: EState;
    _ng_bytes: number;
    _ng_packets: number;
    _ng_error: string;
    _ng_addr: string;
    _ng_port: number;
    private _subscription;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    private _onIncomeMessage;
    private _onIncomeEvent;
    _ng_onConnect(): void;
    _ng_onDisconnect(): void;
    _ng_onCloseError(): void;
}
