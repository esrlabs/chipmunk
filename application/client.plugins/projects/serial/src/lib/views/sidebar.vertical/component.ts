// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ViewChild } from '@angular/core';
import { EHostEvents } from '../../common/host.events';
import { IPortInfo, IPortState, IPortSession } from '../../common/interface.portinfo';
import { IOptions, CDefaultOptions } from '../../common/interface.options';
import { InputStandardComponent, DDListStandardComponent } from 'chipmunk-client-material';
import { SidebarVerticalPortDialogComponent } from '../dialog/components';
import { Subscription } from 'rxjs';
import * as Toolkit from 'chipmunk.client.toolkit';
import Service from '../../services/service';
import { ENotificationType } from 'chipmunk.client.toolkit';

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

    @Input() public session: string;

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
        if (this._ng_selected.path === port.path) {
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
            if (this._ng_selected.path === connected.port.path) {
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
            this._addDropdownElement(this._ng_selected);
            this._saveDropdownSession(this._ng_selected);
            this._ng_selected = undefined;
            this._forceUpdate();
        }).catch((error: Error) => {
            Service.notify('Error',
                this._error(`Fail to connect to port "${options.path}" due error: ${error.message}`), ENotificationType.error);
        });
    }

    public _ng_onDisconnectPort(port: IPortInfo) {

        this._removeDropdownSession(port);
        this._removeDropdownElement(port);

        Object.values(Service.savedSession).forEach((element) => {
            const found = element.ports.find((eachPort: IPortInfo) => eachPort.path === port.path);
            if (!found) {
                return;
            }
        });
        this._ng_connected = this._ng_connected.filter((connected: IConnected) => {
            return connected.port.path !== port.path;
        });
        this._ng_busy = true;
        this._ng_error = undefined;
        this._ng_options = false;
        this._forceUpdate();
        // Request list of available ports
        Service.disconnect(port.path).then(() => {
            this._ng_busy = false;
            this._forceUpdate();
        }).catch((error: Error) => {
            Service.notify('Error', this._error(`Fail to close port "${port.path}" due error: ${error.message}`), ENotificationType.error);
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
            Service.notify('Error', `Fail to get ports list due error: ${error.message}`, ENotificationType.error);
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
            if (ports[connected.port.path]) {
                Object.assign(connected.state, ports[connected.port.path]);
            }
            return connected;
        });
        this._forceUpdate();
    }

    private _hostEvents_onDisconnected(port: string) {
        this._ng_connected = this._ng_connected.filter((connected: IConnected) => {
            return connected.port.path !== port;
        });
        this._requestPortsList();
        this._forceUpdate();
    }

    private _hostEvents_onError(port: string, error: string) {
        this._error(`Port "${port}" error: ${error}`);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

    public _ng_sendMessage( message: string, event?: KeyboardEvent ) {
        Service.sendMessage(message, this._chosenPort).catch((error: Error) => {
            Service.notify('Error', error.message, ENotificationType.error);
        });
        this._inputCom.setValue('');
    }

    private _addDropdownElement(port: IPortInfo) {
        this._ng_changeDropdownSelect(port.path);
        const entry: IPortListItem = {value: port.path, caption: port.path};
        if (!this._ng_portList.includes(entry)) {
            this._ng_portList.unshift(entry);
        }
        this._setDropdownDefault(port.path);
    }

    private _removeDropdownElement(port: IPortInfo) {
        this._ng_portList = this._ng_portList.filter(eachPort => eachPort.value !== port.path);
        if (this._ng_portList.length > 0) {
            this._ng_changeDropdownSelect(this._ng_portList[0].value);
            this._setDropdownDefault(this._ng_portList[0].value);
        } else {
            this._ng_changeDropdownSelect(undefined);
            this._setDropdownDefault('');
        }
    }

    private _setDropdownDefault(path: string) {
        this._ng_defaultPort = path;
    }

    private _saveDropdownSession(port: IPortInfo) {
        const savedSession = Service.savedSession;
        if (!savedSession[this.session]) {
            savedSession[this.session] =  {default: '', ports: []};
        }
        const found = savedSession[this.session].ports.find(eachPort => eachPort.path === port.path);
        if (!found) {
            savedSession[this.session].ports.unshift(port);
        }
        savedSession[this.session].default = port.path;
    }

    private _removeDropdownSession(port: IPortInfo) {
        const session: IPortSession | undefined = Service.savedSession[this.session];
        if (!session) {
            return;
        }
        session.ports = session.ports.filter(each => each.path !== port.path);
        if (session.default === port.path) {
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
            if (port.path === value && Service.savedSession[this.session]) {
                Service.savedSession[this.session].default = port.path;
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
        const connectedPorts: string[] = this._ng_connected.map(connected => connected.port.path);
        this._ng_ports.forEach(port => {
            if (connectedPorts.indexOf(port.path) === -1) {
                this._portOptions.push({path: port.path, options: this._options.options, reader: this._options.reader});
            }
        });
    }

    private _startSpy() {
        this._createOptions();
        Service.startSpy(this._portOptions).catch((error: Error) => {
            Service.notify('Error', error.message, ENotificationType.error);
        });
    }

    private _filterPorts(ports: IPortInfo[]): Promise<IPortInfo[]> {
        return new Promise((resolve) => {
            const CPORTS = {};
            Service.readConfig().then((response: {[key: string]: any}) => {
                Object.assign(CPORTS, response.settings);
                resolve(ports.filter((port: IPortInfo) => {
                    return CPORTS[port.path];
                }));
            }).catch((error: Error) => {
                Service.notify('Error', error.message, ENotificationType.error);
            });
        });
    }

    public _ng_connectDialog(recent: boolean) {
        Service.requestPorts().then((response) => {
            this._startSpy();
            Service.addPopup({
                caption: 'Choose port to connect:',
                component: {
                    factory: SidebarVerticalPortDialogComponent,
                    inputs: {
                        _onConnect: (() => {
                            Service.stopSpy(this._portOptions).then(() => {
                                this._portOptions = [];
                                this._ng_onConnect();
                                Service.removePopup();
                            }).catch((error: Error) => {
                                Service.notify('Error', error.message, ENotificationType.error);
                            });
                        }),
                        _ng_canBeConnected: this._ng_canBeConnected,
                        _ng_connected: this._ng_connected,
                        _ng_onOptions: this._ng_onOptions,
                        _ng_onPortSelect: this._ng_onPortSelect,
                        _getPortOptions: () => this._portOptions,
                        _setPortOptions: (options: IOptions[]) => {
                            this._portOptions = options;
                        },
                        _ng_recent: recent,
                        _requestPortList: (): Promise<IPortInfo[]> =>  {
                            return new Promise((resolve) => {
                                if (recent) {
                                    this._filterPorts(response.ports).then((ports: IPortInfo[]) => {
                                        return resolve(ports);
                                    }).catch((error: Error) => {
                                        Service.notify('Error', error.message, ENotificationType.error);
                                    });
                                } else {
                                    return resolve(response.ports);
                                }
                            });
                        },
                        _getSelected: (selected: IPortInfo) => { this._ng_selected = selected; },
                        _getOptionsCom: (options: IOptions) => { this._optionsCom = options; },
                    }
                },
                buttons: [
                    {
                        caption: 'Cancel',
                        handler: () => {
                            Service.removePopup();
                        }
                    }
                ],
                options: {
                    width: recent ? 26 : 24
                }
            });
        }).catch((error: Error) => {
            Service.notify('Error', `Fail to get ports list due error: ${error.message}`, ENotificationType.error);
        });
    }
}
