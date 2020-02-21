import { OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { IPortInfo, IPortState } from '../../common/interface.portinfo';
import { IOptions } from '../../common/interface.options';
import { InputStandardComponent, DDListStandardComponent } from 'chipmunk-client-material';
interface IConnected {
    port: IPortInfo;
    options: IOptions;
    state: IPortState;
}
interface IPortListItem {
    value: string;
    caption: string;
}
export declare class SidebarVerticalComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    _inputCom: InputStandardComponent;
    _selectCom: DDListStandardComponent;
    session: string;
    private _subscriptions;
    private _logger;
    private _destroyed;
    private _chosenPort;
    private _portOptions;
    private _options;
    private _optionsCom;
    _ng_ports: IPortInfo[];
    _ng_connected: IConnected[];
    _ng_selected: IPortInfo | undefined;
    _ng_busy: boolean;
    _ng_error: string | undefined;
    _ng_options: boolean;
    _ng_msg: string;
    _ng_portList: IPortListItem[];
    _ng_defaultPort: string | undefined;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    _ng_onPortSelect(port: IPortInfo): boolean;
    _ng_canBeConnected(): boolean;
    _ng_onOptions(): void;
    _ng_onConnect(): void;
    _ng_onDisconnectPort(port: IPortInfo): void;
    _ng_onReloadPortsList(): void;
    private _onIncomeMessage;
    private _onIncomeEvent;
    private _saveState;
    private _loadState;
    private _requestPortsList;
    private _error;
    private _hostEvents_onState;
    private _hostEvents_onDisconnected;
    private _hostEvents_onError;
    private _forceUpdate;
    _ng_sendMessage(message: string, event?: KeyboardEvent): void;
    private _addDropdownElement;
    private _removeDropdownElement;
    private _setDropdownDefault;
    private _saveDropdownSession;
    private _removeDropdownSession;
    private _restoreDropdownSession;
    _ng_changeDropdownSelect(value: string): void;
    private _loadSession;
    private _createOptions;
    private _startSpy;
    private _filterPorts;
    _ng_connectDialog(recent: boolean): void;
}
export {};
