import { ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { IPortInfo, IPortState } from '../../common/interface.portinfo';
import { IOptions } from '../../common/interface.options';
import { SidebarVerticalPortOptionsWriteComponent } from '../sidebar.vertical/port.options.write/component';
interface IConnected {
    port: IPortInfo;
    options: IOptions;
    state: IPortState;
}
export declare class SidebarVerticalPortDialogComponent implements OnInit, OnDestroy {
    private _cdRef;
    _optionsCom: SidebarVerticalPortOptionsWriteComponent;
    _onConnect: () => void;
    _requestPortList: () => IPortInfo[];
    _getSelected: (IPortInfo: any) => void;
    _getOptionsCom: (SidebarVerticalPortOptionsWriteComponent: any) => void;
    _getSpyState: () => {
        [key: string]: number;
    };
    _ng_canBeConnected: () => boolean;
    _ng_connected: IConnected[];
    _ng_onOptions: () => void;
    _ng_onPortSelect: (port: IPortInfo) => void;
    private _subscriptions;
    private _destroyed;
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
    ngOnDestroy(): void;
    private _forceUpdate;
    private _getOptions;
    _ng_isConnected(port: IPortInfo): IConnected;
    _ng_onConnect(): void;
    _ng_isPortSelected(port: IPortInfo): boolean;
    _ng_getState(port: IPortInfo): IPortState;
    _ng_formatLoad(load: number): string;
}
export {};
