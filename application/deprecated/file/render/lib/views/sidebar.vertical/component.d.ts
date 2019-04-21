import { OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
export interface IEnvVar {
    key: string;
    value: string;
}
export declare class SidebarVerticalComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    ipc: Toolkit.PluginIPC;
    session: string;
    _ng_file: string;
    _ng_read: string;
    _ng_size: string;
    private _file;
    private _size;
    private _read;
    private _subscription;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    _ng_onOpenClick(): void;
    private _onIncomeMessage;
    private _onIncomeEvent;
    private _updateInfo;
}
