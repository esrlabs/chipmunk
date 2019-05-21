import { OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { IForkSettings } from '../../common/interface.settings';
import * as Toolkit from 'logviewer.client.toolkit';
export interface IEnvVar {
    key: string;
    value: string;
}
export declare class SidebarVerticalComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    ipc: Toolkit.PluginIPC;
    session: string;
    _ng_envvars: IEnvVar[];
    _ng_settings: IForkSettings | undefined;
    private _subscription;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    private _sendInput;
    private _onIncomeMessage;
    private _onIncomeEvent;
    private _settingsUpdated;
}
