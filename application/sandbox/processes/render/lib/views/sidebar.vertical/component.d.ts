import { OnDestroy, ChangeDetectorRef, AfterViewInit, ElementRef } from '@angular/core';
import { IForkSettings } from '../../common/interface.settings';
import * as Toolkit from 'logviewer.client.toolkit';
export interface IEnvVar {
    key: string;
    value: string;
}
export declare class Process {
    private _session;
    private _api;
    private static _processSerial;
    _ng_id: number;
    _ng_envvars: IEnvVar[];
    _ng_settings: IForkSettings | undefined;
    _ng_working: boolean;
    _ng_cmd: string;
    constructor(_session: string, _api: Toolkit.IAPI);
    commandStarted(): void;
    _ng_onKeyUp(event: KeyboardEvent): void;
    private _sendInput;
    private _sendCommand;
    _ng_onStop(event: MouseEvent): void;
    private _sendStop;
}
export declare class SidebarVerticalComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    _ng_input: ElementRef;
    api: Toolkit.IAPI;
    session: string;
    sessions: Toolkit.ControllerSessionsEvents;
    _ng_envvars: IEnvVar[];
    _ng_settings: IForkSettings | undefined;
    _ng_processes: Process[];
    _ng_ready: boolean;
    private _subscriptions;
    private _logger;
    private _destroyed;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    private _onIncomeMessage;
    private _onIncomeEvent;
    private _settingsUpdated;
    private _onSessionChange;
    private _onSessionOpen;
    private _onSessionClose;
    private _saveState;
    private _loadState;
    private _initState;
    private _forceUpdate;
}
