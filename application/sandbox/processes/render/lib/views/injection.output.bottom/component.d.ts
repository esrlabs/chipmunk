import { OnDestroy, ChangeDetectorRef, AfterViewInit, ElementRef } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
export declare class InjectionOutputBottomComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    _ng_input: ElementRef;
    ipc: Toolkit.PluginIPC;
    session: string;
    _ng_cwd: string;
    _ng_working: boolean;
    private _subscription;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    _ng_onKeyUp(event: KeyboardEvent): void;
    private _sendCommand;
    private _sendInput;
    private _onIncomeMessage;
    private _onIncomeEvent;
}
