import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit } from '@angular/core';
import { ErrorStateMatcher } from '@angular/material';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { Subscription, Subject } from 'rxjs';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { NotificationsService, ENotificationType } from '../../../services.injectable/injectable.service.notifications';
import { IServices } from '../../../services/shared.services.sidebar';

import * as Toolkit from 'chipmunk.client.toolkit';

import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import SessionsService from '../../../services/service.sessions.tabs';
import ConnectionsService, { IConnectEvent } from '../../../services/service.connections';

interface IState {
    bindingAddress: string;
    bindingPort: string;
    multicastAddress: string;
    multicastInterface: string;
    connectionId: string;
    ecu: string;
    bindingPanel: boolean;
    multicastPanel: boolean;
    multicast: boolean;
    state: 'progress' | 'connected' | 'disconnected';
}

interface IDLTDeamonSettings {
    // Basic
    connectionId: string;
    ecu: string;
    bindingAddress: string;
    bindingPort: string;
    // multicast
    multicast: boolean;
    multicastAddress: string;
    multicastInterface: string;
}

interface IDLTDeamonSettingsErrorStateMatcher {
    ecu: ErrorStateMatcher;
    bindingAddress: ErrorStateMatcher;
    bindingPort: ErrorStateMatcher;
    multicastAddress: ErrorStateMatcher;
    multicastInterface: ErrorStateMatcher;
}

enum EDLTSettingsFieldAlias {
    bindingAddress = 'bindingAddress',
    bindingPort = 'bindingPort',
    multicastAddress = 'multicastAddress',
    multicastInterface = 'multicastInterface',
    ecu = 'ecu',
}

enum EDLTSettingsErrorCodes {
    NO_ERRORS = 'NO_ERRORS',
    REQUIRED = 'REQUIRED',
    INVALID = 'INVALID',
}

export class DLTDeamonSettingsErrorStateMatcher implements ErrorStateMatcher {

    readonly _alias: EDLTSettingsFieldAlias;
    private _code: EDLTSettingsErrorCodes = EDLTSettingsErrorCodes.NO_ERRORS;

    constructor(alias: EDLTSettingsFieldAlias) {
        this._alias = alias;
    }

    public isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
        if (this.isDLTSettingsFieldRequired(control.value)) {
            this._code = EDLTSettingsErrorCodes.REQUIRED;
        } else  if (!this.isDLTSettingsFieldValid(control.value)) {
            this._code = EDLTSettingsErrorCodes.INVALID;
        } else {
            this._code = EDLTSettingsErrorCodes.NO_ERRORS;
        }
        return this._code !== EDLTSettingsErrorCodes.NO_ERRORS;
    }

    public isDLTSettingsFieldValid(value: string): boolean {
        if (typeof value !== 'string') {
            return false;
        }
        switch (this._alias) {
            case EDLTSettingsFieldAlias.ecu:
                if (value.length > 4) {
                    return false;
                }
                return value.replace(/[\d\w_]/gi, '').length === 0;
            case EDLTSettingsFieldAlias.bindingAddress:
            case EDLTSettingsFieldAlias.multicastAddress:
            case EDLTSettingsFieldAlias.multicastInterface:
                return value.search(/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi) !== -1;
            case EDLTSettingsFieldAlias.bindingPort:
                if (value.trim().search(/^\d{1,}$/gi) === -1) {
                    return false;
                }
                const bindingPort = parseInt(value.trim(), 10);
                return isNaN(bindingPort) ? false : (!isFinite(bindingPort) ? false : true);
        }
    }

    public isDLTSettingsFieldRequired(value: string): boolean {
        if (typeof value !== 'string') {
            return true;
        }
        switch (this._alias) {
            case EDLTSettingsFieldAlias.ecu:
            case EDLTSettingsFieldAlias.bindingAddress:
            case EDLTSettingsFieldAlias.bindingPort:
            case EDLTSettingsFieldAlias.multicastAddress:
            case EDLTSettingsFieldAlias.multicastInterface:
                return value.trim() === '';
        }
    }

    public getErrorCode(): EDLTSettingsErrorCodes {
        return this._code;
    }

    public isValid(): boolean {
        return this._code === EDLTSettingsErrorCodes.NO_ERRORS;
    }

}

@Component({
    selector: 'app-sidebar-app-dlt-connector',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppDLTConnectorComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    public static StateKey = 'side-bar-dlt-connector-view';

    @Input() public services: IServices;
    @Input() public onBeforeTabRemove: Subject<void>;
    @Input() public close: () => void;

    public _ng_session: ControllerSessionTab | undefined;
    public _ng_state: 'progress' | 'connected' | 'disconnected' = 'disconnected';
    public _ng_settings: IDLTDeamonSettings = {
        connectionId: '',
        ecu: '',
        bindingAddress: '',
        bindingPort: '',
        multicast: false,
        multicastAddress: '',
        multicastInterface: '0.0.0.0',
    };
    public _ng_panels: {
        binding: boolean,
        multicast: boolean,
    } = {
        binding: true,
        multicast: false,
    };
    public _ng_errorStates: IDLTDeamonSettingsErrorStateMatcher = {
        ecu: new DLTDeamonSettingsErrorStateMatcher(EDLTSettingsFieldAlias.ecu),
        bindingAddress: new DLTDeamonSettingsErrorStateMatcher(EDLTSettingsFieldAlias.bindingAddress),
        bindingPort: new DLTDeamonSettingsErrorStateMatcher(EDLTSettingsFieldAlias.bindingPort),
        multicastAddress: new DLTDeamonSettingsErrorStateMatcher(EDLTSettingsFieldAlias.multicastAddress),
        multicastInterface: new DLTDeamonSettingsErrorStateMatcher(EDLTSettingsFieldAlias.multicastInterface),
    };

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppDLTConnectorComponent');
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
        this._ng_session = SessionsService.getActive();
        this._subscriptions.onSessionChange = SessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
    }

    public ngOnDestroy() {
        this._destroyed = true;
        this._saveState();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
    }

    public ngAfterViewInit() {
        this._subscriptions.onBeforeTabRemove = this.onBeforeTabRemove.asObservable().subscribe(this._onBeforeTabRemove.bind(this));
        this._subscriptions.onDisconnected = ConnectionsService.getObservable().disconnected.subscribe(this._onDisconnected.bind(this));
        this._loadState();
        this._checkConnection();
        this._forceUpdate();
    }

    public _ng_onPanelClick() {
        this._forceUpdate();
    }

    public _ng_onPanelToggle(panel: 'binding' | 'multicast', open: boolean) {
        this._ng_panels[panel] = open;
    }

    public _ng_isSettingsValid(): boolean {
        let valid: boolean = true;
        Object.keys(this._ng_errorStates).forEach((key: EDLTSettingsFieldAlias) => {
            if ([EDLTSettingsFieldAlias.multicastAddress, EDLTSettingsFieldAlias.multicastInterface].includes(key) && this._ng_settings.multicast === false) {
                return;
            }
            if (!(this._ng_errorStates[key] as DLTDeamonSettingsErrorStateMatcher).isValid()) {
                valid = false;
            }
        });
        return valid;
    }

    public _ng_onConnectClick() {
        if (!this._ng_isSettingsValid()) {
            return this._forceUpdate();
        }
        const prevState = this._ng_state;
        this._ng_state = 'progress';
        this._ng_settings.connectionId = Toolkit.guid();
        ElectronIpcService.request(new IPCMessages.DLTDeamonConnectRequest({
            id: this._ng_settings.connectionId,
            session: this._ng_session.getGuid(),
            ecu: this._ng_settings.ecu,
            bindingAddress: this._ng_settings.bindingAddress,
            bindingPort: this._ng_settings.bindingPort,
            multicastAddress: this._ng_settings.multicastAddress,
            multicastInterface: this._ng_settings.multicastInterface,
        }), IPCMessages.DLTDeamonConnectResponse).then((response: IPCMessages.DLTDeamonConnectResponse) => {
            this._ng_state = 'connected';
            this._forceUpdate();
        }).catch((error: Error) => {
            this._ng_state = prevState;
            this._logger.error(`Fail to connect due error: ${error.message}`);
            this._notifications.add({
                caption: `DLT: ${this._ng_settings.bindingAddress}:${this._ng_settings.bindingPort}`,
                message: `Error: ${error.message}`,
                options: {
                    type: ENotificationType.error
                }
            });
        });
        this._forceUpdate();
    }

    public _ng_onDisconnectClick() {
        const prevState = this._ng_state;
        this._ng_state = 'progress';
        ElectronIpcService.request(new IPCMessages.DLTDeamonDisconnectRequest({
            id: this._ng_settings.connectionId,
            session: this._ng_session.getGuid(),
        }), IPCMessages.DLTDeamonConnectResponse).then((response: IPCMessages.DLTDeamonConnectResponse) => {
            if (typeof response.error === 'string') {
                this._notifications.add({
                    caption: `DLT: ${this._ng_settings.bindingAddress}:${this._ng_settings.bindingPort}`,
                    message: `Error: ${response.error}`,
                    options: {
                        type: ENotificationType.error
                    }
                });
                this._logger.error(`Fail to correctly disconnect due error: ${response.error}`);
            }
            this._ng_state = 'disconnected';
            this._ng_settings.connectionId = '';
            this._forceUpdate();
        }).catch((error: Error) => {
            this._ng_state = prevState;
            this._logger.error(`Fail to disconnect due error: ${error.message}`);
            this._notifications.add({
                caption: `DLT: ${this._ng_settings.bindingAddress}:${this._ng_settings.bindingPort}`,
                message: `Error: ${error.message}`,
                options: {
                    type: ENotificationType.error
                }
            });
        });
        this._forceUpdate();
    }

    public _ng_onMuliticastingStateChange() {
        this._forceUpdate();
    }

    private _onBeforeTabRemove() {
        this._ng_session.getSessionsStates().drop(this._getStateGuid());
    }

    private _loadState(): void {
        if (this._ng_session === undefined) {
            return;
        }
        const state: IState | undefined = this._ng_session.getSessionsStates().get<IState>(this._getStateGuid());
        if (state) {
            this._ng_state = state.state;
            this._ng_panels.binding = state.bindingPanel;
            this._ng_panels.multicast = state.multicastPanel;
            this._ng_settings.connectionId = state.connectionId;
            this._ng_settings.ecu = state.ecu;
            this._ng_settings.multicast = state.multicast;
            this._ng_settings.bindingPort = state.bindingPort;
            this._ng_settings.bindingAddress = state.bindingAddress;
            this._ng_settings.multicastAddress = state.multicastAddress;
            this._ng_settings.multicastInterface = state.multicastInterface;
        }
    }

    private _saveState(): void {
        if (this._ng_session === undefined) {
            return;
        }
        this._ng_session.getSessionsStates().set<IState>(
            this._getStateGuid(),
            {
                state: this._ng_state,
                bindingPanel: this._ng_panels.binding,
                multicastPanel: this._ng_panels.multicast,
                connectionId: this._ng_settings.connectionId,
                ecu: this._ng_settings.ecu,
                multicast: this._ng_settings.multicast,
                bindingPort: this._ng_settings.bindingPort,
                bindingAddress: this._ng_settings.bindingAddress,
                multicastAddress: this._ng_settings.multicastAddress,
                multicastInterface: this._ng_settings.multicastInterface,
            }
        );
    }

    private _dropState(): void {
    }

    private _checkConnection() {
        if (this._ng_settings.connectionId === '') {
            return;
        }
        if (ConnectionsService.hasConnection(this._ng_session.getGuid(), this._ng_settings.connectionId)) {
            // Connection still exist
            return;
        }
        this._dropConnectionState();
    }

    private _getStateGuid(): string {
        return `${SidebarAppDLTConnectorComponent.StateKey}:${this._ng_session.getGuid()}`;
    }

    private _onSessionChange(session: ControllerSessionTab) {
        // Save previos
        this._saveState();
        // Drop state before
        this._dropState();
        // Change session
        this._ng_session = session;
        if (session !== undefined) {
            // Try to load
            this._loadState();
        }
        // Update
        this._forceUpdate();
    }

    private _onDisconnected(event: IConnectEvent) {
        if (this._ng_session.getGuid() !== event.session) {
            return;
        }
        if (this._ng_settings.connectionId !== event.id) {
            return;
        }
        this._dropConnectionState();
    }

    private _dropConnectionState() {
        this._ng_settings.connectionId = '';
        this._ng_state = 'disconnected';
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
