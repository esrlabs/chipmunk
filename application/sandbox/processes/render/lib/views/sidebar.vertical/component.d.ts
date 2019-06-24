import { OnDestroy, ChangeDetectorRef, AfterViewInit, ElementRef } from '@angular/core';
import { IForkSettings } from '../../common/interface.settings';
import * as Toolkit from 'logviewer.client.toolkit';
export interface IEnvVar {
    key: string;
    value: string;
}
export declare class SidebarVerticalComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    _ng_input: ElementRef;
    ipc: Toolkit.PluginIPC;
    session: string;
    sessions: Toolkit.ControllerSessionsEvents;
    _ng_envvars: IEnvVar[];
    _ng_settings: IForkSettings | undefined;
    _ng_working: boolean;
    _ng_cmd: string;
    private _subscriptions;
    private _logger;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    _ng_onKeyUp(event: KeyboardEvent): void;
    _ng_onStop(event: MouseEvent): void;
    private _sendCommand;
    private _sendStop;
    private _sendInput;
    private _onIncomeMessage;
    private _onIncomeEvent;
    private _settingsUpdated;
    private _onSessionChange;
    private _onSessionOpen;
    private _onSessionClose;
    private _saveState;
    private _loadState;
}
