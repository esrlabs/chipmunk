import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterViewInit,
} from '@angular/core';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Subscription, Subject, Observable } from 'rxjs';
import { Session } from '../../../controller/session/session';
import {
    NotificationsService,
    ENotificationType,
} from '../../../services.injectable/injectable.service.notifications';
import { IServices } from '../../../services/shared.services.sidebar';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { DLTDeamonSettingsErrorStateMatcher, EDLTSettingsFieldAlias } from './state.error';
import { IPC } from '../../../services/service.electron.ipc';
import { IConnectEvent } from '../../../services/service.connections';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';
import { IDLTDeamonMulticast } from './multicast/component';
import { MatButtonToggleChange } from '@angular/material/button-toggle';
import { FormControl } from '@angular/forms';
import { map, startWith } from 'rxjs/operators';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import * as Toolkit from 'chipmunk.client.toolkit';
import * as moment_timezone from 'moment-timezone';

import ElectronIpcService from '../../../services/service.electron.ipc';
import SessionsService from '../../../services/service.sessions.tabs';
import ConnectionsService from '../../../services/service.connections';
import ContextMenuService from '../../../services/standalone/service.contextmenu';
import EventsSessionService from '../../../services/standalone/service.events.session';

interface IState {
    bindingAddress: string;
    bindingPort: string;
    connectionId: string;
    ecu: string;
    multicast: IPC.IDLTDeamonConnectionMulticastOptions[];
    fibex: boolean;
    state: 'progress' | 'connected' | 'disconnected';
    target: IPC.EDLTDeamonConnectionType;
    timezone: string;
}

interface IDLTDeamonSettings {
    // Basic
    connectionId: string;
    ecu: string;
    bindingAddress: string;
    bindingPort: string;
    // multicast
    multicast: IDLTDeamonMulticast[];
    // fibex
    fibex: boolean;
    fibexFiles: IPC.IFilePickerFileInfo[];
    // Connection type
    target: IPC.EDLTDeamonConnectionType;
    timezone: string;
}

const CDefaulsDLTSettingsField = {
    ecu: '',
    bindingAddress: '0.0.0.0',
    bindingPort: '',
    multicast: [],
    multicastAddress: '',
    multicastInterface: '0.0.0.0',
    fibex: false,
    fibexFiles: [],
    target: IPC.EDLTDeamonConnectionType.Udp,
    timezone: 'UTC',
};

// TODO: take care about prev format of settins (single multicast) to prevent error on restoring state
// ECU ID -> Label

@Component({
    selector: 'app-sidebar-app-dlt-connector',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppDLTConnectorComponent implements OnDestroy, AfterContentInit, AfterViewInit {
    public static StateKey = 'side-bar-dlt-connector-view';

    @Input() public services!: IServices;
    @Input() public onBeforeTabRemove!: Subject<void>;
    @Input() public close!: () => void;

    public _ng_session: Session | undefined;
    public _ng_state: 'progress' | 'connected' | 'disconnected' = 'disconnected';
    public _ng_recent: string[] = [];
    public _ng_settings: IDLTDeamonSettings = {
        connectionId: '',
        ecu: CDefaulsDLTSettingsField.ecu,
        bindingAddress: CDefaulsDLTSettingsField.bindingAddress,
        bindingPort: CDefaulsDLTSettingsField.bindingPort,
        multicast: CDefaulsDLTSettingsField.multicast.slice(),
        fibex: CDefaulsDLTSettingsField.fibex,
        fibexFiles: CDefaulsDLTSettingsField.fibexFiles,
        target: CDefaulsDLTSettingsField.target,
        timezone: CDefaulsDLTSettingsField.timezone,
    };
    public _ng_errorStates: { [key: string]: DLTDeamonSettingsErrorStateMatcher } = {
        ecu: new DLTDeamonSettingsErrorStateMatcher(EDLTSettingsFieldAlias.ecu),
        bindingAddress: new DLTDeamonSettingsErrorStateMatcher(
            EDLTSettingsFieldAlias.bindingAddress,
        ),
        bindingPort: new DLTDeamonSettingsErrorStateMatcher(EDLTSettingsFieldAlias.bindingPort),
    };

    public _ng_allowSaveAs: boolean = false;
    public _ng_multicastCleanSubject: Subject<void> = new Subject<void>();
    public _ng_timezones: string[] = [];

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppDLTConnectorComponent');
    private _destroyed: boolean = false;
    private _recent: IPC.IDLTDeamonConnectionOptions[] = [];
    private _timezones: { name: string; fullName: string; utcOffset: number }[] = [];

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _notifications: NotificationsService,
        private _sanitizer: DomSanitizer,
    ) {
        this._ng_session = SessionsService.getActive();
        const now = new Date();
        const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth());
        this._timezones = moment_timezone.tz
            .names()
            .map((tzName: string) => {
                const zone = moment_timezone.tz.zone(tzName);
                if (zone === null) {
                    return undefined;
                } else {
                    const offset = zone.utcOffset(utc);
                    return {
                        name: tzName,
                        utcOffset: offset,
                        fullName: `${tzName} (${offset === 0 ? '' : offset > 0 ? '-' : '+'}${
                            Math.abs(offset) / 60
                        } UTC)`,
                    };
                }
            })
            .filter((t) => t !== undefined) as {
            name: string;
            fullName: string;
            utcOffset: number;
        }[];
        this._timezones.unshift({ name: 'UTC', utcOffset: 0, fullName: 'UTC' });
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.multicastCleanSubject = this._ng_multicastCleanSubject.subscribe(
            this._checkEmptyMulticasts.bind(this),
        );
    }

    public ngOnDestroy() {
        this._destroyed = true;
        this._saveState();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._ng_timezones = this._filterTimeZones('');
        this._loadRecent();
    }

    public ngAfterViewInit() {
        this._subscriptions.onBeforeTabRemove = this.onBeforeTabRemove
            .asObservable()
            .subscribe(this._onBeforeTabRemove.bind(this));
        this._subscriptions.onDisconnected =
            ConnectionsService.getObservable().disconnected.subscribe(
                this._onDisconnected.bind(this),
            );
        this._loadState();
        this._checkConnection();
        this._forceUpdate();
    }

    public _ng_onTypeConnectionChange(event: MatButtonToggleChange) {
        this._ng_settings.target =
            event.value === IPC.EDLTDeamonConnectionType.Udp
                ? IPC.EDLTDeamonConnectionType.Udp
                : IPC.EDLTDeamonConnectionType.Tcp;
        this._forceUpdate();
    }

    public _ng_isSettingsValid(): boolean {
        let valid: boolean = true;
        Object.keys(this._ng_errorStates).forEach((key: string) => {
            if (!(this._ng_errorStates[key] as DLTDeamonSettingsErrorStateMatcher).isValid()) {
                valid = false;
            }
        });
        this._ng_settings.multicast.forEach((multicast) => {
            if (!multicast.state.address.isValid() || !multicast.state.interface.isValid()) {
                valid = false;
            }
        });
        return valid;
    }

    public _ng_onConnectClick() {
        if (this._ng_session === undefined) {
            return;
        }
        if (!this._ng_isSettingsValid()) {
            return this._forceUpdate();
        }
        const prevState = this._ng_state;
        const mcast: string[] = [];
        this._ng_state = 'progress';
        this._ng_settings.connectionId = Toolkit.guid();
        const tzIndex = this._timezones.findIndex((v) => v.name === this._ng_settings.timezone);
        ElectronIpcService.request<IPC.DLTDeamonConnectResponse>(
            new IPC.DLTDeamonConnectRequest({
                id: this._ng_settings.connectionId,
                session: this._ng_session.getGuid(),
                ecu: this._ng_settings.ecu,
                bindingAddress: this._ng_settings.bindingAddress,
                bindingPort: this._ng_settings.bindingPort,
                multicast: this._ng_settings.multicast
                    .map((i) => {
                        return {
                            address: i.address,
                            interface: i.interface,
                        };
                    })
                    .filter((i) => {
                        // Get rid of duplicates
                        const key: string = `${i.address}${i.interface}`;
                        const exist: boolean = mcast.indexOf(key) === -1;
                        mcast.push(key);
                        return exist;
                    }),
                fibex: this._ng_settings.fibexFiles,
                target: this._ng_settings.target,
                timezone: tzIndex <= 0 ? undefined : this._timezones[tzIndex].name,
            }),
            IPC.DLTDeamonConnectResponse,
        )
            .then((response) => {
                this._ng_state = 'connected';
                this._loadRecent();
                this._forceUpdate();
            })
            .catch((error: Error) => {
                this._ng_state = prevState;
                this._logger.error(`Fail to connect due error: ${error.message}`);
                this._notifications.add({
                    caption: `DLT: ${this._ng_settings.bindingAddress}:${this._ng_settings.bindingPort}`,
                    message: `Error: ${error.message}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
            });
        this._forceUpdate();
    }

    public _ng_onDisconnectClick() {
        if (this._ng_session === undefined) {
            return;
        }
        const prevState = this._ng_state;
        this._ng_state = 'progress';
        ElectronIpcService.request<IPC.DLTDeamonConnectResponse>(
            new IPC.DLTDeamonDisconnectRequest({
                id: this._ng_settings.connectionId,
                session: this._ng_session.getGuid(),
            }),
            IPC.DLTDeamonConnectResponse,
        )
            .then((response) => {
                if (typeof response.error === 'string') {
                    this._notifications.add({
                        caption: `DLT: ${this._ng_settings.bindingAddress}:${this._ng_settings.bindingPort}`,
                        message: `Error: ${response.error}`,
                        options: {
                            type: ENotificationType.error,
                        },
                    });
                    this._logger.error(`Fail to correctly disconnect due error: ${response.error}`);
                }
                this._ng_allowSaveAs = true;
                this._ng_state = 'disconnected';
                this._ng_settings.connectionId = '';
                this._forceUpdate();
            })
            .catch((error: Error) => {
                this._ng_state = prevState;
                this._logger.error(`Fail to disconnect due error: ${error.message}`);
                this._notifications.add({
                    caption: `DLT: ${this._ng_settings.bindingAddress}:${this._ng_settings.bindingPort}`,
                    message: `Error: ${error.message}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
            });
        this._forceUpdate();
    }

    public _ng_onAddMulticastClick() {
        if (
            this._ng_settings.multicast.find(
                (i) => i.address.trim() === '' || i.interface.trim() === '',
            ) !== undefined
        ) {
            return;
        }
        if (
            this._ng_settings.multicast.find(
                (i) => !i.state.address.isValid() || !i.state.interface.isValid(),
            ) !== undefined
        ) {
            return;
        }
        this._ng_settings.multicast.push({
            address: CDefaulsDLTSettingsField.multicastAddress,
            interface: CDefaulsDLTSettingsField.multicastInterface,
            state: {
                address: new DLTDeamonSettingsErrorStateMatcher(
                    EDLTSettingsFieldAlias.multicastAddress,
                ),
                interface: new DLTDeamonSettingsErrorStateMatcher(
                    EDLTSettingsFieldAlias.multicastInterface,
                ),
            },
        });
        this._forceUpdate();
    }

    public _ng_onSaveAsClick() {
        if (this._ng_session === undefined) {
            return;
        }
        ElectronIpcService.request<IPC.DLTDeamonSaveResponse>(
            new IPC.DLTDeamonSaveRequest({
                session: this._ng_session.getGuid(),
            }),
            IPC.DLTDeamonSaveResponse,
        )
            .then((response) => {
                if (typeof response.error === 'string') {
                    this._notifications.add({
                        caption: `DLT Saving`,
                        message: `Error: ${response.error}`,
                        options: {
                            type: ENotificationType.error,
                        },
                    });
                    this._logger.error(
                        `Fail to correctly save DLT stream due error: ${response.error}`,
                    );
                }
                this._forceUpdate();
            })
            .catch((error: Error) => {
                this._logger.error(`Fail to save DLT due error: ${error.message}`);
                this._notifications.add({
                    caption: `DLT Saving`,
                    message: `Error: ${error.message}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
            });
    }

    public _ng_onMuliticastingStateChange() {
        this._forceUpdate();
    }

    public _ng_onECUChange(value: string) {
        if (typeof value === 'string') {
            this._ng_recent = this._recent
                .filter((options: IPC.IDLTDeamonConnectionOptions) => {
                    return options.ecu.toLowerCase().includes(value.toLowerCase());
                })
                .map((options: IPC.IDLTDeamonConnectionOptions) => {
                    return options.ecu;
                });
        } else {
            this._ng_recent = this._recent.map((options: IPC.IDLTDeamonConnectionOptions) => {
                return options.ecu;
            });
        }
        this._forceUpdate();
    }

    public _ng_onTZChange(value: string) {
        this._ng_timezones = this._filterTimeZones(typeof value === 'string' ? value : '');
        this._forceUpdate();
    }

    public _ng_onRecentSelected(event: MatAutocompleteSelectedEvent) {
        const ecu: string = event.option.viewValue;
        if (typeof ecu !== 'string' || ecu.trim() === '') {
            return;
        }
        this._ng_settings.ecu = ecu;
        this._applyRecent(ecu);
    }

    public _ng_onContexMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: `Clear Recent Options`,
                handler: () => {
                    ElectronIpcService.request(
                        new IPC.DLTDeamonRecentDropRequest(),
                        IPC.DLTDeamonRecentDropResponse,
                    )
                        .then(() => {
                            this._recent = [];
                            this._ng_recent = [];
                            this._forceUpdate();
                        })
                        .catch((error: Error) => {
                            this._logger.error(
                                `Fail drop recent options due error: ${error.message}`,
                            );
                        });
                },
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    public _ng_onMulticastContexMenu(event: MouseEvent, index?: number) {
        const items: IMenuItem[] = [
            {
                caption: 'Remove All',
                handler: () => {
                    this._ng_settings.multicast = [];
                    this._forceUpdate();
                },
            },
        ];
        if (typeof index === 'number') {
            items.push({
                caption: 'Remove',
                handler: () => {
                    this._ng_settings.multicast.splice(index, 1);
                    this._forceUpdate();
                },
            });
        }
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    public _ng_onAddFibexFile() {
        ElectronIpcService.request<IPC.FilePickerResponse>(
            new IPC.FilePickerRequest({
                filter: [{ name: 'XML files', extensions: ['xml'] }],
                multiple: true,
            }),
            IPC.FilePickerResponse,
        )
            .then((responce) => {
                if (typeof responce.error === 'string') {
                    return this._notifications.add({
                        caption: `Fail open`,
                        message: `Fail to pickup file due error: ${responce.error}`,
                        options: {
                            type: ENotificationType.error,
                        },
                    });
                }
                responce.files = responce.files
                    .filter((incomeFile: IPC.IFilePickerFileInfo) => {
                        let fileIsIn: boolean = false;
                        this._ng_settings.fibexFiles.forEach(
                            (existFile: IPC.IFilePickerFileInfo) => {
                                if (existFile.path === incomeFile.path) {
                                    fileIsIn = true;
                                }
                            },
                        );
                        return !fileIsIn;
                    })
                    .map((file: IPC.IFilePickerFileInfo) => {
                        (file as any).viewPath = file.path
                            .replace(file.name, '')
                            .replace(/[^\w\d\.\_\-]$/gi, '');
                        return file;
                    });
                this._ng_settings.fibexFiles.push(...responce.files);
                this._forceUpdate();
            })
            .catch((error: Error) => {
                this._notifications.add({
                    caption: `Fail open`,
                    message: `Fail to pickup file due error: ${error.message}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
            });
    }

    public _ng_onFibexFileDragged(event: CdkDragDrop<string[]>) {
        const target: IPC.IFilePickerFileInfo = Object.assign(
            {},
            this._ng_settings.fibexFiles[event.previousIndex],
        );
        this._ng_settings.fibexFiles = this._ng_settings.fibexFiles.filter(
            (file: IPC.IFilePickerFileInfo, i: number) => {
                return i !== event.previousIndex;
            },
        );
        this._ng_settings.fibexFiles.splice(event.currentIndex, 0, target);
        this._forceUpdate();
    }

    public _ng_onFibexContexMenu(event: MouseEvent, file: IPC.IFilePickerFileInfo) {
        const items: IMenuItem[] = [
            {
                caption: `Remove`,
                handler: () => {
                    this._ng_settings.fibexFiles = this._ng_settings.fibexFiles.filter(
                        (item: IPC.IFilePickerFileInfo) => {
                            return file.path !== item.path;
                        },
                    );
                    this._forceUpdate();
                },
            },
            {
                caption: `Remove All`,
                handler: () => {
                    this._ng_settings.fibexFiles = [];
                    this._forceUpdate();
                },
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    public _ng_getSafeHTML(input: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(input);
    }

    public _ng_onTzSelected(event: MatAutocompleteSelectedEvent) {
        this._ng_settings.timezone = event.option.viewValue;
    }

    private _checkEmptyMulticasts() {
        this._ng_settings.multicast = this._ng_settings.multicast.filter((mcast) => {
            return mcast.address.trim() !== '' && mcast.interface.trim() !== '';
        });
        this._forceUpdate();
    }

    private _onBeforeTabRemove() {
        this._ng_session?.getSessionsStates().drop(this._getStateGuid());
    }

    private _loadState(): void {
        if (this._ng_session === undefined) {
            return;
        }
        const state: IState | undefined = this._ng_session
            .getSessionsStates()
            .get<IState>(this._getStateGuid());
        if (state) {
            this._ng_state = state.state;
            this._ng_settings.connectionId = state.connectionId;
            this._ng_settings.ecu = state.ecu;
            if (state.multicast instanceof Array) {
                this._ng_settings.multicast = state.multicast.map((i) => {
                    return {
                        address: i.address,
                        interface: i.interface,
                        state: {
                            address: new DLTDeamonSettingsErrorStateMatcher(
                                EDLTSettingsFieldAlias.multicastAddress,
                            ),
                            interface: new DLTDeamonSettingsErrorStateMatcher(
                                EDLTSettingsFieldAlias.multicastInterface,
                            ),
                        },
                    };
                });
            } else if (typeof state.multicast === 'object' && state.multicast !== null) {
                this._ng_settings.multicast = [
                    {
                        address: (state.multicast as any).multicastAddress,
                        interface: (state.multicast as any).multicastInterface,
                        state: {
                            address: new DLTDeamonSettingsErrorStateMatcher(
                                EDLTSettingsFieldAlias.multicastAddress,
                            ),
                            interface: new DLTDeamonSettingsErrorStateMatcher(
                                EDLTSettingsFieldAlias.multicastInterface,
                            ),
                        },
                    },
                ];
            } else {
                this._ng_settings.multicast = [];
            }
            this._ng_settings.fibex = state.fibex;
            this._ng_settings.bindingPort = state.bindingPort;
            this._ng_settings.bindingAddress = CDefaulsDLTSettingsField.bindingAddress;
            this._ng_settings.target =
                state.target === undefined ? CDefaulsDLTSettingsField.target : state.target;
        } else {
            this._ng_settings = {
                connectionId: '',
                ecu: CDefaulsDLTSettingsField.ecu,
                bindingAddress: CDefaulsDLTSettingsField.bindingAddress,
                bindingPort: CDefaulsDLTSettingsField.bindingPort,
                multicast: CDefaulsDLTSettingsField.multicast.slice(),
                fibex: CDefaulsDLTSettingsField.fibex,
                fibexFiles: CDefaulsDLTSettingsField.fibexFiles,
                target: CDefaulsDLTSettingsField.target,
                timezone: CDefaulsDLTSettingsField.timezone,
            };
        }
    }

    private _saveState(): void {
        if (this._ng_session === undefined) {
            return;
        }
        this._ng_session.getSessionsStates().set<IState>(this._getStateGuid(), {
            state: this._ng_state,
            connectionId: this._ng_settings.connectionId,
            ecu: this._ng_settings.ecu,
            multicast: this._ng_settings.multicast.map((i) => {
                return {
                    address: i.address,
                    interface: i.interface,
                };
            }),
            fibex: this._ng_settings.fibex,
            bindingPort: this._ng_settings.bindingPort,
            bindingAddress: this._ng_settings.bindingAddress,
            target: this._ng_settings.target,
            timezone: this._ng_settings.timezone,
        });
    }

    private _dropState(): void {}

    private _checkConnection() {
        if (this._ng_session === undefined) {
            return;
        }
        if (this._ng_settings.connectionId === '') {
            return;
        }
        if (
            ConnectionsService.hasConnection(
                this._ng_session.getGuid(),
                this._ng_settings.connectionId,
            )
        ) {
            // Connection still exist
            return;
        }
        this._dropConnectionState();
    }

    private _getStateGuid(): string {
        return `${SidebarAppDLTConnectorComponent.StateKey}:${this._ng_session?.getGuid()}`;
    }

    private _onSessionChange(session: Session | undefined) {
        if (session === undefined) {
            return;
        }
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
        if (this._ng_session === undefined || this._ng_session.getGuid() !== event.session) {
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

    private _loadRecent() {
        ElectronIpcService.request<IPC.DLTDeamonRecentResponse>(
            new IPC.DLTDeamonRecentRequest(),
            IPC.DLTDeamonRecentResponse,
        )
            .then((response) => {
                if (response.recent instanceof Array) {
                    this._recent = response.recent;
                    this._ng_recent = this._recent.map(
                        (options: IPC.IDLTDeamonConnectionOptions) => {
                            return options.ecu;
                        },
                    );
                } else {
                    this._recent = [];
                }
            })
            .catch((error: Error) => {
                this._logger.error(`Fail to get recent options due error: ${error.message}`);
                this._recent = [];
            });
    }

    private _applyRecent(ecu: string) {
        const options: IPC.IDLTDeamonConnectionOptions | undefined = this._recent.find(
            (opt: IPC.IDLTDeamonConnectionOptions) => {
                return opt.ecu === ecu;
            },
        );
        if (options === undefined) {
            return;
        }
        this._ng_settings.bindingAddress = CDefaulsDLTSettingsField.bindingAddress;
        this._ng_settings.bindingPort = options.bindingPort;
        this._ng_settings.multicast = options.multicast.map((i: any) => {
            return {
                address: i.address,
                interface: i.interface,
                state: {
                    address: new DLTDeamonSettingsErrorStateMatcher(
                        EDLTSettingsFieldAlias.multicastAddress,
                    ),
                    interface: new DLTDeamonSettingsErrorStateMatcher(
                        EDLTSettingsFieldAlias.multicastInterface,
                    ),
                },
            };
        });
        this._ng_settings.target =
            options.target === undefined ? CDefaulsDLTSettingsField.target : options.target;
        if (options.fibex instanceof Array && options.fibex.length > 0) {
            this._ng_settings.fibex = true;
            this._ng_settings.fibexFiles = options.fibex;
        } else {
            this._ng_settings.fibex = CDefaulsDLTSettingsField.fibex;
            this._ng_settings.fibexFiles = CDefaulsDLTSettingsField.fibexFiles;
        }
        this._ng_settings.timezone =
            options.timezone === undefined ? CDefaulsDLTSettingsField.timezone : options.timezone;
        this._forceUpdate();
    }

    private _filterTimeZones(filter: string): string[] {
        filter = filter.replace(/[^\d\w\s+-\\]/gi, '');
        const key = Toolkit.regTools.createFromStr(filter);
        if (key instanceof Error) {
            return this._timezones.map((v) => v.fullName);
        }
        return this._timezones
            .map((tz) => {
                let match: RegExpMatchArray | null = tz.fullName.match(key);
                if (match === null || match.length === 0) {
                    return undefined;
                }
                return tz.fullName.replace(match[0], `<span>${match[0]}</span>`);
            })
            .filter((tz) => tz !== undefined) as string[];
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
