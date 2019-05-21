import { OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
export declare class TaskbarStateComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    ipc: Toolkit.PluginIPC;
    session: string;
    _ng_read: string;
    _ng_size: string;
    _ng_state: string;
    _ng_progress: boolean;
    _ng_processing: string;
    private _file;
    private _size;
    private _read;
    private _subscription;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    private _onIncomeMessage;
    private _onIncomeEvent;
    private _updateInfo;
}
