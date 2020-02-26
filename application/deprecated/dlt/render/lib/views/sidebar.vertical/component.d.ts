import { OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';
import { InputStandardComponent } from 'chipmunk-client-material';
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
    _ng_input_ip: InputStandardComponent;
    _ng_input_port: InputStandardComponent;
    api: Toolkit.IAPI;
    session: string;
    _ng_state: EState;
    _ng_bytes: number;
    _ng_packets: number;
    _ng_error: string;
    _ng_addr: string | undefined;
    _ng_port: number | undefined;
    private _subscription;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    _ng_onIPValidate(value: string): string | undefined;
    _ng_onPortValidate(value: string): string | undefined;
    _ng_onIPChange(value: string): void;
    _ng_onPortChange(value: string): void;
    private _onIncomeMessage;
    private _onIncomeEvent;
    _ng_onConnect(): void;
    _ng_onDisconnect(): void;
    _ng_onCloseError(): void;
}
