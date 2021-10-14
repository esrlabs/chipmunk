import {
    ChangeDetectorRef,
    Component,
    Input,
    OnDestroy,
    OnInit,
    QueryList,
    ViewChildren,
    ViewEncapsulation,
} from '@angular/core';
import { SidebarAppAdbService, IAmount } from '../services/service';
import { Session } from '../../../../controller/session/session';
import {
    NotificationsService,
    ENotificationType,
} from '../../../../services.injectable/injectable.service.notifications';
import { IAdbDevice, IAdbProcess } from '../../../../../../../../common/interfaces/interface.adb';
import { MatSelect } from '@angular/material/select';
import { IPC } from '../../../../services/service.electron.ipc';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { sortPairs, IPair } from '../../../../thirdparty/code/engine';
import { Subscription, Subject } from 'rxjs';

import TabsSessionsService from '../../../../services/service.sessions.tabs';
import EventsSessionService from '../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

interface ILogLevel {
    name: string;
    flag: string;
}

@Component({
    selector: 'app-sidebar-app-adb-logcat',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class SidebarAppAdbLogcatComponent implements OnInit, OnDestroy {
    @Input() public service!: SidebarAppAdbService;

    @ViewChildren(MatSelect) _ng_matSelectList!: QueryList<MatSelect>;

    public readonly _ng_noDevice: IAdbDevice = {
        name: '<No device selected>',
        type: '',
    };
    public _ng_devices: IAdbDevice[] = [this._ng_noDevice];
    public _ng_deviceSelected: IAdbDevice = this._ng_noDevice;
    public _ng_running: boolean = false;
    public _ng_amount: string = '0 bytes';
    public readonly _ng_logLevels: ILogLevel[] = [
        { name: 'Verbose', flag: 'V' },
        { name: 'Debug', flag: 'D' },
        { name: 'Info', flag: 'I' },
        { name: 'Warn', flag: 'W' },
        { name: 'Error', flag: 'E' },
        { name: 'Fatal', flag: 'F' },
        { name: 'Silent', flag: 'S' },
    ];
    public readonly _ng_noProcessPair: IPair = {
        caption: '<No process selected>',
        description: ' ',
        id: '-1',
    };
    public _ng_logLevelSelected: string = this._ng_logLevels[0].flag;
    public _ng_processSearchTerm: string = '';
    public _ng_processSelected: IPair = {
        caption: '<No process selected>',
        description: ' ',
        id: '-1',
    };
    public _ng_processPairs: IPair[] = [];
    public _ng_scrollIntoViewTrigger: Subject<void> = new Subject();
    public _ng_loadProcessesDone: boolean = false;
    public _ng_loadDevicesDone: boolean = false;

    private _session: string | undefined;
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppAdbLogcatComponent');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _processPairs: IPair[] = [];
    private _prevDevice: IAdbDevice = this._ng_noDevice;

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _notifications: NotificationsService,
        private _sanitizer: DomSanitizer,
    ) {}

    public ngOnInit() {
        const session: Session | undefined = TabsSessionsService.getActive();
        if (session !== undefined) {
            this._session = session.getGuid();
        } else {
            this._logger.error('Session not available');
        }
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.onAmount = this.service
            .getObservable()
            .onAmount.subscribe(this._onAmount.bind(this));
        this._subscriptions.onDisconnect = this.service
            .getObservable()
            .onDisconnect.subscribe(this._onDisconnect.bind(this));
        this._init();
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onDeviceChange() {
        if (this._ng_deviceSelected.name !== this._prevDevice.name) {
            this._ng_processSelected = this._ng_noProcessPair;
            this._processPairs = [];
            this._stop();
            if (this._ng_deviceSelected.name === this._ng_noDevice.name) {
                this._prevDevice = this._ng_noDevice;
                return;
            }
        }
        this._start();
        this._prevDevice = this._ng_deviceSelected;
    }

    public _ng_onChange() {
        if (this._ng_deviceSelected.name === this._ng_noDevice.name) {
            return;
        }
        if (this._session === undefined) {
            this._logger.error(`Session guid isn't defined`);
            return;
        }
        const id = parseInt(this._ng_processSelected.id, 10);
        this.service
            .change({
                session: this._session,
                device: this._ng_deviceSelected.name,
                level: this._ng_logLevelSelected,
                pid: id === -1 ? undefined : id,
            })
            .then(() => {
                this._ng_running = true;
            })
            .catch((error: Error) => {
                this._notifications.add({
                    caption: 'Fail to change loglevel',
                    message: `Failed to change adb settings for device ${this._ng_deviceSelected.name} due to error: ${error.message}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
                this._logger.error(
                    `Failed to change adb settings for device ${this._ng_deviceSelected.name} due to error: ${error.message}`,
                );
            });
    }

    public _ng_onProcessMousedown(process: IPair) {
        this._ng_processSelected = process;
        this._ng_onChange();
    }

    public _ng_onDeviceOpen(open: boolean) {
        if (open) {
            this._detectDevices();
        }
    }

    public _ng_onProcessOpen(open: boolean) {
        if (!open) {
            this._ng_processSearchTerm = '';
            this._ng_processPairs = this._filter(this._ng_processSearchTerm);
            return;
        }
        this._ng_loadProcessesDone = false;
        this._detectProcesses()
            .then(() => {
                this._ng_processSearchTerm = '';
                this._ng_processPairs = this._filter(this._ng_processSearchTerm);
            })
            .catch((error: Error) => {
                this._notifications.add({
                    caption: 'Fail to detect processes',
                    message: `Failed to processes for device ${this._ng_deviceSelected.name} due to error: ${error.message}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
                this._logger.error(
                    `Failed to processes for device ${this._ng_deviceSelected.name} due to error: ${error.message}`,
                );
            })
            .finally(() => {
                this._ng_loadProcessesDone = true;
            });
    }

    public _ng_onCloseSearch() {
        this._ng_processSearchTerm = '';
        this._ng_processPairs = this._filter(this._ng_processSearchTerm);
    }

    public _ng_onKeyup(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            this._ng_processSearchTerm = '';
        } else if (event.key === 'Backspace' && this._ng_processSearchTerm.length > 0) {
            this._ng_processSearchTerm = this._ng_processSearchTerm.slice(
                0,
                this._ng_processSearchTerm.length - 1,
            );
        } else if (event.key.length > 1) {
            return;
        } else {
            this._ng_processSearchTerm += event.key;
        }
        this._ng_loadProcessesDone = false;
        this._ng_processPairs = this._filter(this._ng_processSearchTerm);
        this._ng_loadProcessesDone = true;
    }

    public _ng_getSafeHTML(str: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(str);
    }

    private _filter(value: string): IPair[] {
        if (typeof value !== 'string') {
            return [];
        }
        const scored = sortPairs(this._processPairs, value, value !== '', 'span');
        this._ng_scrollIntoViewTrigger.next();
        return scored;
    }

    private _init() {
        if (this._session === undefined) {
            this._logger.error(`Session guid isn't defined`);
            return;
        }
        this.service
            .prepare({ guid: this._session })
            .then(() => {
                this._ng_devices = [this._ng_noDevice];
                this._processPairs = [];
                this._ng_amount = this.service.bytesToString(0);
                this._ng_logLevelSelected = this._ng_logLevels[0].flag;
                this._ng_deviceSelected = this._ng_devices[0];
                this._ng_processSelected = this._processPairs[0];
                this._restore();
            })
            .catch((error: Error) => {
                this._notifications.add({
                    caption: 'Fail to prepare adb',
                    message: `Failed to prepare adb due to error: ${error.message}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
                this._logger.error(`Failed to prepare adb due to error: ${error.message}`);
            });
    }

    private _restore() {
        if (this._session === undefined) {
            this._logger.error(`Session guid isn't defined`);
            return;
        }
        this.service
            .restore({ session: this._session })
            .then((response: IPC.AdbLoadResponse) => {
                if (this._session !== response.session) {
                    return;
                }
                this._ng_amount = this.service.bytesToString(response.data.recieved);
                this._ng_logLevelSelected = response.data.logLevel;
                this._ng_devices = [this._ng_noDevice, ...response.data.devices];
                this._processPairs = [
                    ...response.data.processes.map((process: IAdbProcess) => {
                        return {
                            caption: process.name,
                            description: ' ',
                            id: `${process.pid}`,
                        };
                    }),
                ];
                if (response.data.device !== undefined) {
                    const found: IAdbDevice | undefined = this._ng_devices.find(
                        (device: IAdbDevice) => device.name === response.data.device,
                    );
                    this._ng_deviceSelected = found === undefined ? this._ng_noDevice : found;
                } else {
                    this._ng_deviceSelected = this._ng_noDevice;
                }
                if (response.data.pid !== undefined) {
                    const found: IPair | undefined = this._processPairs.find(
                        (process: IPair) => parseInt(process.id, 10) === response.data.pid,
                    );
                    this._ng_processSelected = found === undefined ? this._ng_noProcessPair : found;
                } else {
                    this._ng_processSelected = this._ng_noProcessPair;
                }
            })
            .catch((error: Error) => {
                this._notifications.add({
                    caption: 'Fail to restore adb session',
                    message: `Failed to restore session for adb due to error: ${error.message}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
                this._logger.error(
                    `Failed to restore session for adb due to error: ${error.message}`,
                );
            });
    }

    private _start() {
        if (this._session === undefined) {
            this._logger.error(`Session guid isn't defined`);
            return;
        }
        const id = parseInt(this._ng_processSelected.id, 10);
        this.service
            .start({
                session: this._session,
                device: this._ng_deviceSelected.name,
                level: this._ng_logLevelSelected,
                pid: id === -1 ? undefined : id,
            })
            .then(() => {
                this._ng_running = true;
            })
            .catch((error: Error) => {
                this._notifications.add({
                    caption: 'Fail to start adb',
                    message: `Failed to start adb on device ${this._ng_deviceSelected.name} due to error: ${error.message}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
                this._logger.error(
                    `Failed to start adb on device ${this._ng_deviceSelected.name} due to error: ${error.message}`,
                );
            });
    }

    private _stop() {
        if (this._session === undefined) {
            this._logger.error(`Session guid isn't defined`);
            return;
        }
        this.service
            .stop({ session: this._session })
            .then(() => {
                this._ng_running = false;
            })
            .catch((error: Error) => {
                this._notifications.add({
                    caption: 'Fail to stop adb',
                    message: `Failed to stop adb due to error: ${error}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
                this._logger.error(`Failed to stop adb due to error: ${error}`);
            });
    }

    private _detectDevices() {
        if (this._session === undefined) {
            this._logger.error(`Session guid isn't defined`);
            return;
        }
        this._ng_loadDevicesDone = false;
        this.service
            .getDevices({ session: this._session })
            .then((response: IAdbDevice[]) => {
                let index: number = -1;
                response.forEach((rDevice: IAdbDevice) => {
                    index = this._ng_devices.findIndex((device: IAdbDevice) => {
                        return device.name === rDevice.name;
                    });
                    if (index === -1) {
                        this._ng_devices.push(rDevice);
                    }
                });
                this._ng_devices.forEach((device: IAdbDevice) => {
                    index = response.findIndex((rDevice: IAdbDevice) => {
                        return device.name === rDevice.name;
                    });
                    if (index === -1 && device.name !== this._ng_noDevice.name) {
                        this._ng_devices.splice(this._ng_devices.indexOf(device), 1);
                    }
                });
            })
            .catch((error: Error) => {
                this._logger.error(`Failed to detect devices due error: ${error.message}`);
            })
            .finally(() => {
                this._ng_loadDevicesDone = true;
            });
    }

    private _detectProcesses(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._session === undefined) {
                return reject(new Error(this._logger.error(`Session guid isn't defined`)));
            }
            if (this._ng_deviceSelected.name === this._ng_noDevice.name) {
                this._processPairs = [];
                return resolve();
            }
            this.service
                .getProcesses({ session: this._session, device: this._ng_deviceSelected.name })
                .then((response: IAdbProcess[]) => {
                    let index: number = -1;
                    response.forEach((process: IAdbProcess) => {
                        index = this._processPairs.findIndex((pair: IPair) => {
                            return (
                                parseInt(pair.id, 10) === process.pid &&
                                pair.caption === process.name
                            );
                        });
                        if (index === -1) {
                            this._processPairs.push({
                                caption: process.name,
                                description: ' ',
                                id: `${process.pid}`,
                            });
                        }
                    });
                    this._processPairs.forEach((pair: IPair) => {
                        index = response.findIndex((process: IAdbProcess) => {
                            return (
                                process.pid === parseInt(pair.id, 10) &&
                                process.name === pair.caption
                            );
                        });
                        if (index === -1) {
                            this._processPairs.splice(this._processPairs.indexOf(pair), 1);
                        }
                    });
                    resolve();
                })
                .catch(reject);
        });
    }

    private _onAmount(event: IAmount) {
        if (this._session !== event.guid) {
            return;
        }
        this._ng_amount = event.amount;
        this._forceUpdate();
    }

    private _onDisconnect(event: IPC.IAdbDeviceDisconnected) {
        if (this._session !== event.guid) {
            return;
        }
        this._ng_deviceSelected = this._ng_noDevice;
        this._ng_processSelected = this._ng_noProcessPair;
    }

    private _onSessionChange(session: Session | undefined) {
        if (session === undefined) {
            return;
        }
        if (session.getGuid() === this._session) {
            return;
        }
        this._session = session.getGuid();
        this._init();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
