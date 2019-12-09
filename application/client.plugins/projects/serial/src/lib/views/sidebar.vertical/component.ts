// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ViewChild } from '@angular/core';
import { EHostEvents } from '../../common/host.events';
import { IPortInfo, IPortState, IPortSession } from '../../common/interface.portinfo';
import { IOptions, CDefaultOptions } from '../../common/interface.options';
import { InputStandardComponent, DDListStandardComponent } from 'chipmunk-client-primitive';
import { SidebarVerticalPortDialogComponent } from '../dialog/components';
import { Subscription } from 'rxjs';
import * as Toolkit from 'chipmunk.client.toolkit';
import Service from '../../services/service';

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

interface IPortListItem {
    value: string;
    caption: string;
}

const state: Toolkit.ControllerState<IState> = new Toolkit.ControllerState<IState>();

@Component({
    selector: Toolkit.EViewsTypes.sidebarVertical,
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarVerticalComponent implements AfterViewInit, OnDestroy {
    @ViewChild('msgInput', {static: false}) _inputCom: InputStandardComponent;
    @ViewChild('selectPort', {static: false}) _selectCom: DDListStandardComponent;

    @Input() public api: Toolkit.IAPI;
    @Input() public session: string;
    @Input() public sessions: Toolkit.ControllerSessionsEvents;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger(`Plugin: serial: inj_output_bot:`);
    private _destroyed: boolean = false;
    private _chosenPort: string = undefined;
    private _portOptions: IOptions[] = [];
    private _options: IOptions = Object.assign({}, CDefaultOptions);
    private _optionsCom: IOptions;

    public _ng_ports: IPortInfo[] = [];
    public _ng_connected: IConnected[] = [];
    public _ng_selected: IPortInfo | undefined;
    public _ng_busy: boolean = false;
    public _ng_error: string | undefined;
    public _ng_options: boolean = false;
    public _ng_spyLoad: { [key: string]: number } = {};
    public _ng_msg: string;
    public _ng_portList: IPortListItem[] = [];
    public _ng_defaultPort: string | undefined = undefined;

    constructor(private _cdRef: ChangeDetectorRef) {
        this._ng_sendMessage = this._ng_sendMessage.bind(this);
        this._ng_changeDropdownSelect = this._ng_changeDropdownSelect.bind(this);
        this._ng_connectDialog = this._ng_connectDialog.bind(this);
    }

    ngOnDestroy() {
        this._destroyed = true;
        this._saveState();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    ngAfterViewInit() {
        Service.popupButton(this._ng_connectDialog);
        this._restoreDropdownSession();
        this._loadSession();

        // Subscription to income events
        this._subscriptions.Subscription = Service.getObservable().event.subscribe((message: any) => {
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
        // Restore state
        this._loadState();
        this._hostEvents_onState(Service.sessionConnected[this.session]);
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
        const options: IOptions = this._optionsCom;
        this._ng_busy = true;
        this._ng_error = undefined;
        this._ng_options = false;
        this._forceUpdate();
        Service.connect(options).then(() => {
            this._ng_busy = false;
            this._ng_connected.push({
                port: this._ng_selected,
                options: options,
                state: {
                    ioState: { read: 0, written: 0 },
                    connections: 0,
                },
            });
            this._ng_spyLoad[this._ng_selected.comName] = 0;
            this._addDropdownElement(this._ng_selected);
            this._saveDropdownSession(this._ng_selected);
            this._ng_selected = undefined;
            this._forceUpdate();
        }).catch((error: Error) => {
            this._logger.error(this._error(`Fail to connect to port "${options.path}" due error: ${error.message}`));
        });
    }

    public _ng_onDisconnectPort(port: IPortInfo) {

        this._removeDropdownSession(port);
        this._removeDropdownElement(port);

        Object.values(Service.savedSession).forEach((element) => {
            const found = element.ports.find((eachPort: IPortInfo) => eachPort.comName === port.comName);
            if (!found) {
                return;
            }
        });
        this._ng_connected = this._ng_connected.filter((connected: IConnected) => {
            return connected.port.comName !== port.comName;
        });
        this._ng_busy = true;
        this._ng_error = undefined;
        this._ng_options = false;
        this._forceUpdate();
        // Request list of available ports
        Service.disconnect(port.comName).then(() => {
            this._ng_busy = false;
            this._forceUpdate();
        }).catch((error: Error) => {
            this._logger.error(this._error(`Fail to close port "${port.comName}" due error: ${error.message}`));
        });
    }

    public _ng_onReloadPortsList() {
        this._requestPortsList();
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
                this._hostEvents_onDisconnected(message.port);
                break;
            case EHostEvents.error:
                this._hostEvents_onError(message.port, message.error);
                break;
            case EHostEvents.state:
                this._hostEvents_onState(Service.state);
                break;
            case EHostEvents.spyState:
                this._hostEvents_onSpyState(message.load);
                break;
        }
        this._forceUpdate();
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
            this._requestPortsList();
        } else {
            Object.keys(stored).forEach((key: string) => {
                (this as any)[key] = stored[key];
            });
        }
        this._forceUpdate();
    }

    private _requestPortsList() {
        this._ng_ports = [];
        Service.requestPorts().then((resolve) => {
            Object.assign(this._ng_ports, resolve.ports);
            this._saveState();
            this._forceUpdate();
        }).catch((error: Error) => {
            this._logger.error(`Fail to get ports list due error: ${error.message}`);
        });
    }

    private _error(msg: string): string {
        this._ng_busy = false;
        this._ng_error = msg;
        this._ng_selected = undefined;
        this._forceUpdate();
        return msg;
    }

    private _hostEvents_onState(ports: {[port: string]: IPortState}) {
        this._ng_connected = this._ng_connected.map((connected: IConnected) => {
            if (ports[connected.port.comName]) {
                Object.assign(connected.state, ports[connected.port.comName]);
            }
            return connected;
        });
        this._forceUpdate();
    }

    private _hostEvents_onDisconnected(port: string) {
        this._ng_connected = this._ng_connected.filter((connected: IConnected) => {
            return connected.port.comName !== port;
        });
        this._requestPortsList();
        this._forceUpdate();
    }

    private _hostEvents_onError(port: string, error: string) {
        this._error(`Port "${port}" error: ${error}`);
    }

    private _hostEvents_onSpyState(load: { [key: string]: number }) {
        Object.assign(this._ng_spyLoad, load);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

    public _ng_sendMessage( message: string, event?: KeyboardEvent ) {
        Service.sendMessage(message, this._chosenPort).catch((error: Error) => {
            this._logger.error(error);
            });
        this._inputCom.setValue('');
    }

    private _addDropdownElement(port: IPortInfo) {
        this._ng_changeDropdownSelect(port.comName);
        const entry: IPortListItem = {value: port.comName, caption: port.comName};
        if (!this._ng_portList.includes(entry)) {
            this._ng_portList.unshift(entry);
        }
        this._setDropdownDefault(port.comName);
    }

    private _removeDropdownElement(port: IPortInfo) {
        this._ng_portList = this._ng_portList.filter(eachPort => eachPort.value !== port.comName);
        if (this._ng_portList.length > 0) {
            this._ng_changeDropdownSelect(this._ng_portList[0].value);
            this._setDropdownDefault(this._ng_portList[0].value);
        } else {
            this._ng_changeDropdownSelect(undefined);
            this._setDropdownDefault('');
        }
    }

    private _setDropdownDefault(comName: string) {
        this._ng_defaultPort = comName;
    }

    private _saveDropdownSession(port: IPortInfo) {
        const savedSession = Service.savedSession;
        if (!savedSession[this.session]) {
            savedSession[this.session] =  {default: '', ports: []};
        }
        const found = savedSession[this.session].ports.find(eachPort => eachPort.comName === port.comName);
        if (!found) {
            savedSession[this.session].ports.unshift(port);
        }
        savedSession[this.session].default = port.comName;
    }

    private _removeDropdownSession(port: IPortInfo) {
        const session: IPortSession | undefined = Service.savedSession[this.session];
        if (!session) {
            return;
        }
        session.ports = session.ports.filter(each => each.comName !== port.comName);
        if (session.default === port.comName) {
            session.default = '';
        }
        Service.savedSession[this.session] = session;
    }

    private _restoreDropdownSession() {
        if (Service.savedSession[this.session]) {
            const ports = Service.savedSession[this.session].ports;
            if (ports) {
                for (const port of ports) {
                    this._addDropdownElement(port);
                }
            }
        }
    }

    public _ng_changeDropdownSelect(value: string) {
        this._chosenPort = value;
        this._ng_ports.forEach( port => {
            if (port.comName === value && Service.savedSession[this.session]) {
                Service.savedSession[this.session].default = port.comName;
            }
        });
    }

    private _loadSession() {
        if (Service.savedSession[this.session]) {
            this._ng_defaultPort = Service.savedSession[this.session].default;
            this._forceUpdate();
        }
    }

    private _createOptions() {
        const connectedPorts: string[] = this._ng_connected.map(connected => connected.port.comName);
        this._ng_ports.forEach(port => {
            if (connectedPorts.indexOf(port.comName) === -1) {
                this._portOptions.push({path: port.comName, options: this._options.options, reader: this._options.reader});
            }
        });
    }

    private _removeOptions() {
        this._portOptions = [];
    }

    private _startSpy() {
        this._createOptions();
        Service.startSpy(this._portOptions).catch((error: Error) => {
            this._logger.error(error);
        });
    }

    private _stopSpy() {
        return new Promise((resolve) => {
            Service.stopSpy(this._portOptions).then(
                resolve
            ).catch((error: Error) => {
                this._logger.error(error);
            });
            this._removeOptions();
        });
    }

    private closePopup(popup: string) {
        Service.closePopup(popup);
    }

    public _ng_connectDialog() {
        Service.requestPorts().then((response) => {
            this._startSpy();
            const popupGuid: string = this.api.addPopup({
                caption: 'Choose port to connect:',
                component: {
                    factory: SidebarVerticalPortDialogComponent,
                    inputs: {
                        _onConnect: (() => {
                            this._stopSpy().then(() => this._ng_onConnect());
                            this.closePopup(popupGuid);
                        }),
                        _ng_canBeConnected: this._ng_canBeConnected,
                        _ng_connected: this._ng_connected,
                        _ng_onOptions: this._ng_onOptions,
                        _ng_onPortSelect: this._ng_onPortSelect,
                        _getSpyState: () => this._ng_spyLoad,
                        _requestPortList: () => response.ports,
                        _getSelected: (selected: IPortInfo) => { this._ng_selected = selected; },
                        _getOptionsCom: (options: IOptions) => { this._optionsCom = options; },
                    }
                },
                buttons: [
                    {
                        caption: 'Cancel',
                        handler: () => {
                            this._stopSpy();
                            this.closePopup(popupGuid);
                        }
                    }
                ]
            });
        }).catch((error: Error) => {
            this._logger.error(`Fail to get ports list due error: ${error.message}`);
        });
    }
}
