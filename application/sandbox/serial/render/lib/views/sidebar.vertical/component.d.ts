import { OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { IPortInfo, IPortState } from '../../common/interface.portinfo';
import { IOptions } from '../../common/interface.options';
import { SidebarVerticalPortOptionsWriteComponent } from './port.options.write/component';
import * as Toolkit from 'logviewer.client.toolkit';
interface IConnected {
    port: IPortInfo;
    options: IOptions;
    state: IPortState;
}
export declare class SidebarVerticalComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    _optionsCom: SidebarVerticalPortOptionsWriteComponent;
    ipc: Toolkit.PluginIPC;
    session: string;
    sessions: Toolkit.ControllerSessionsEvents;
    private _subscriptions;
    private _logger;
    private _destroyed;
    _ng_ports: IPortInfo[];
    _ng_connected: IConnected[];
    _ng_selected: IPortInfo | undefined;
    _ng_busy: boolean;
    _ng_error: string | undefined;
    _ng_options: boolean;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    _ng_isPortSelected(port: IPortInfo): boolean;
    _ng_onPortSelect(port: IPortInfo): boolean;
    _ng_canBeConnected(): boolean;
    _ng_onOptions(): void;
    _ng_onConnect(): void;
    _ng_getState(port: IPortInfo): IPortState;
    _ng_onDisconnectPort(port: IPortInfo): void;
    private _onIncomeMessage;
    private _onIncomeEvent;
    private _onSessionChange;
    private _onSessionOpen;
    private _onSessionClose;
    private _saveState;
    private _loadState;
    private _initState;
    private _updateConnectedPortsState;
    private _getOptions;
    private _forceUpdate;
}
export {};
