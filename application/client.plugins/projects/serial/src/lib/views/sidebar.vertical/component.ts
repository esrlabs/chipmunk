// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ViewChild } from '@angular/core';
import { EHostEvents, EHostCommands } from '../../common/host.events';
import { IPortInfo, IPortState, IIOState } from '../../common/interface.portinfo';
import { IOptions, CDefaultOptions } from '../../common/interface.options';
import { SidebarVerticalPortOptionsWriteComponent } from './port.options.write/component';

import * as Toolkit from 'logviewer.client.toolkit';

interface IState {
    _ng_ports: IPortInfo[];
    _ng_connected: IConnected[];
    _ng_error: string | undefined;
    _ng_selected: IPortInfo | undefined;
}

interface IConnected {
    port: IPortInfo;
    options: IOptions;
    state: IPortState;
}

const state: Toolkit.ControllerState<IState> = new Toolkit.ControllerState<IState>();

@Component({
    selector: Toolkit.EViewsTypes.sidebarVertical,
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarVerticalComponent implements AfterViewInit, OnDestroy {
    @ViewChild('optionsCom') _optionsCom: SidebarVerticalPortOptionsWriteComponent;

    @Input() public ipc: Toolkit.PluginIPC;
    @Input() public session: string;
    @Input() public sessions: Toolkit.ControllerSessionsEvents;

    private _subscriptions: { [key: string]: Toolkit.Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger(`Plugin: serial: inj_output_bot:`);
    private _destroyed: boolean = false;

    public _ng_ports: IPortInfo[] = [];
    public _ng_connected: IConnected[] = [];
    public _ng_selected: IPortInfo | undefined;
    public _ng_busy: boolean = false;
    public _ng_error: string | undefined;
    public _ng_options: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngOnDestroy() {
        this._destroyed = true;
        this._saveState();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    ngAfterViewInit() {
        // Subscription to income events
        this._subscriptions.incomeIPCHostMessage = this.ipc.subscribeToHost((message: any) => {
            if (typeof message !== 'object' && message === null) {
                // Unexpected format of message
                return;
            }
            if (message.streamId !== this.session && message.streamId !== '*') {
                // No definition of streamId
                return;
            }
            this._onIncomeMessage(message);
        });
        // Subscribe to sessions events
        this._subscriptions.onSessionChange = this.sessions.subscribe().onSessionChange(this._onSessionChange.bind(this));
        this._subscriptions.onSessionOpen = this.sessions.subscribe().onSessionOpen(this._onSessionOpen.bind(this));
        this._subscriptions.onSessionClose = this.sessions.subscribe().onSessionClose(this._onSessionClose.bind(this));
        // Restore state
        this._loadState();
    }

    public _ng_isPortSelected(port: IPortInfo): boolean {
        if (this._ng_selected === undefined) {
            return false;
        }
        return this._ng_selected.comName === port.comName ? true : false;
    }

    public _ng_onPortSelect(port: IPortInfo) {
        if (this._ng_busy) {
            return false;
        }
        this._ng_error = undefined;
        this._ng_options = false;
        if (this._ng_selected === undefined) {
            this._ng_selected = port;
            this._forceUpdate();
            return;
        }
        if (this._ng_selected.comName === port.comName) {
            this._ng_selected = undefined;
        } else {
            this._ng_selected = port;
        }
        this._forceUpdate();
    }

    public _ng_canBeConnected(): boolean {
        if (this._ng_busy) {
            return false;
        }
        if (this._ng_selected === undefined) {
            return false;
        }
        let isConnected: boolean = false;
        this._ng_connected.forEach((connected: IConnected) => {
            if (this._ng_selected.comName === connected.port.comName) {
                isConnected = true;
            }
        });
        return !isConnected;
    }

    public _ng_onOptions() {
        this._ng_options = !this._ng_options;
        this._forceUpdate();
    }

    public _ng_onConnect() {
        if (!this._ng_canBeConnected()) {
            return;
        }
        const options: IOptions = this._getOptions();
        this._ng_busy = true;
        this._ng_error = undefined;
        this._ng_options = false;
        this._forceUpdate();
        this.ipc.requestToHost({
            stream: this.session,
            command: EHostCommands.open,
            options: options,
        }, this.session).then((response) => {
            this._ng_busy = false;
            this._ng_connected.push({
                port: this._ng_selected,
                options: options,
                state: {
                    ioState: { read: 0, written: 0 },
                    connections: 0,
                },
            });
            this._ng_selected = undefined;
            this._forceUpdate();
        }).catch((error: Error) => {
            this._logger.error(`Fail to get ports list due error: ${error.message}`);
        });
    }

    public _ng_getState(port: IPortInfo): IPortState {
        const target: IConnected | undefined = this._ng_connected.find((connected: IConnected) => {
            return connected.port.comName === port.comName;
        });
        if (target === undefined) {
            return {
                connections: 0,
                ioState: { written: 0, read: 0 }
            };
        } else {
            return target.state;
        }
    }

    public _ng_onDisconnectPort(port: IPortInfo) {
        this._ng_connected = this._ng_connected.filter((connected: IConnected) => {
            return connected.port.comName !== port.comName;
        });
        this._ng_busy = true;
        this._ng_error = undefined;
        this._ng_options = false;
        this._forceUpdate();
        // Request list of available ports
        this.ipc.requestToHost({
            stream: this.session,
            command: EHostCommands.close,
            path: port.comName,
        }, this.session).then((response) => {
            this._ng_busy = false;
            this._forceUpdate();
        }).catch((error: Error) => {
            this._ng_error = `Fail to close port "${port.comName}" due error: ${error.message}`;
            this._ng_busy = false;
            this._logger.error(this._ng_error);
            this._forceUpdate();
        });
    }

    private _onIncomeMessage(message: any) {
        if (typeof message.event === 'string') {
            // Process events
            return this._onIncomeEvent(message);
        }
    }

    private _onIncomeEvent(message: any) {
        switch (message.event) {
            case EHostEvents.connected:
                break;
            case EHostEvents.disconnected:
                break;
            case EHostEvents.error:
                break;
            case EHostEvents.state:
                this._updateConnectedPortsState(message.state);
                break;
        }
        this._forceUpdate();
    }

    private _onSessionChange(guid: string) {
        this._saveState();
        this.session = guid;
        this._loadState();
    }

    private _onSessionOpen(guid: string) {
        //
    }

    private _onSessionClose(guid: string) {
        //
    }

    private _saveState() {
        state.save(this.session, {
            _ng_ports: this._ng_ports,
            _ng_connected: this._ng_connected,
            _ng_error: this._ng_error,
            _ng_selected: this._ng_selected,
        });
    }

    private _loadState() {
        this._ng_ports = [];
        this._ng_connected = [];
        this._ng_error = undefined;
        this._ng_selected = undefined;
        this._ng_busy = false;
        const stored: IState | undefined = state.load(this.session);
        if (stored === undefined || stored._ng_ports.length === 0) {
            this._initState();
        } else {
            Object.keys(stored).forEach((key: string) => {
                (this as any)[key] = stored[key];
            });
        }
        this._forceUpdate();
    }

    private _initState() {
        // Request list of available ports
        this.ipc.requestToHost({
            stream: this.session,
            command: EHostCommands.list,
        }, this.session).then((response) => {
            this._ng_ports = response.ports;
            this._saveState();
            this._forceUpdate();
        }).catch((error: Error) => {
            this._logger.error(`Fail to get ports list due error: ${error.message}`);
        });
    }

    private _updateConnectedPortsState(ports: { [key: string]: IPortState }) {
        this._ng_connected = this._ng_connected.map((connected: IConnected) => {
            if (ports[connected.port.comName] !== undefined) {
                connected.state = ports[connected.port.comName];
            }
            return connected;
        });
        this._forceUpdate();
    }

    private _getOptions(): IOptions {
        let options: IOptions = Object.assign({}, CDefaultOptions);
        if (this._optionsCom !== undefined && this._optionsCom !== null) {
            options = this._optionsCom.getOptions();
        }
        options.path = this._ng_selected.comName;
        return options;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
