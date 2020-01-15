import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit, ViewContainerRef } from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';
import { Subscription, Subject } from 'rxjs';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import SessionsService from '../../../services/service.sessions.tabs';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { NotificationsService, ENotificationType } from '../../../services.injectable/injectable.service.notifications';
import { IServices } from '../../../services/shared.services.sidebar';

interface IState {
    bindingAddress: string;
    bindingPort: string;
    multicastAddress: string;
    multicastInterface: string;
    binding: boolean;
    multicast: boolean;
}

interface IDLTDeamonSettings {
    bindingAddress: string;
    bindingPort: string;
    multicastAddress: string;
    multicastInterface: string;
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
        bindingAddress: '',
        bindingPort: '',
        multicastAddress: '',
        multicastInterface: '',
    };
    public _ng_panels: {
        binding: boolean,
        multicast: boolean,
    } = {
        binding: true,
        multicast: false,
    };

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppDLTConnectorComponent');
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef,
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
        this._loadState();
    }

    public _ng_onPanelClick() {
        this._forceUpdate();
    }

    public _ng_onPanelToggle(panel: 'binding' | 'mulitcast', open: boolean) {
        this._ng_panels[panel] = open;
    }

    public _ng_onConnectClick() {
        const prevState = this._ng_state;
        this._ng_state = 'progress';
        ElectronIpcService.request(new IPCMessages.DLTDeamonConnectRequest({
            id: Toolkit.guid(),
            session: this._ng_session.getGuid(),
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
            id: Toolkit.guid(),
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

    private _onBeforeTabRemove() {
        this._ng_session.getSessionsStates().drop(this._getStateGuid());
    }

    private _loadState(): void {
        if (this._ng_session === undefined) {
            return;
        }
        const state: IState | undefined = this._ng_session.getSessionsStates().get<IState>(this._getStateGuid());
        if (state) {
            this._ng_panels.binding = state.binding;
            this._ng_panels.multicast = state.multicast;
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
                binding: this._ng_panels.binding,
                multicast: this._ng_panels.multicast,
                bindingPort: this._ng_settings.bindingPort,
                bindingAddress: this._ng_settings.bindingAddress,
                multicastAddress: this._ng_settings.multicastAddress,
                multicastInterface: this._ng_settings.multicastInterface,
            }
        );
    }

    private _dropState(): void {
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

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
