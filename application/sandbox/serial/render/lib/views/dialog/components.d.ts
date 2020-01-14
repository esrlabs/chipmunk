import { ChangeDetectorRef, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { IPortInfo, IPortState } from '../../common/interface.portinfo';
import { IOptions } from '../../common/interface.options';
import { SidebarVerticalPortOptionsWriteComponent } from '../sidebar.vertical/port.options.write/component';
import { Observable } from 'rxjs';
interface IConnected {
    port: IPortInfo;
    options: IOptions;
    state: IPortState;
}
export declare class SidebarVerticalPortDialogComponent implements OnInit, OnDestroy, AfterViewInit {
    private _cdRef;
    _optionsCom: SidebarVerticalPortOptionsWriteComponent;
    _onConnect: () => void;
    _requestPortList: () => Promise<IPortInfo[]>;
    _getSelected: (IPortInfo: any) => void;
    _getOptionsCom: (SidebarVerticalPortOptionsWriteComponent: any) => void;
    _getPortOptions: () => IOptions[];
    _setPortOptions: (options: IOptions[]) => void;
    _ng_canBeConnected: () => boolean;
    _ng_connected: IConnected[];
    _ng_onOptions: () => void;
    _ng_onPortSelect: (port: IPortInfo) => void;
    _ng_recent: boolean;
    private _interval;
    private _timeout;
    private _subscriptions;
    private _destroyed;
    private _subjects;
    private _logger;
    _ng_ports: IPortInfo[];
    _ng_selected: IPortInfo | undefined;
    _ng_busy: boolean;
    _ng_error: string | undefined;
    _ng_options: boolean;
    _ng_spyState: {
        [key: string]: number;
    };
    constructor(_cdRef: ChangeDetectorRef);
    ngOnInit(): void;
    ngAfterViewInit(): void;
    ngOnDestroy(): void;
    private _refreshPortList;
    onTick(): {
        tick: Observable<boolean>;
    };
    private _next;
    private _onSpyState;
    private _forceUpdate;
    private _stopSpy;
    private _getOptions;
    _ng_onConnect(port?: IPortInfo): void;
    _ng_isPortSelected(port: IPortInfo): boolean;
    _ng_getState(port: IPortInfo): IPortState;
    _ng_onRemovePort(port: string): void;
}
export {};
