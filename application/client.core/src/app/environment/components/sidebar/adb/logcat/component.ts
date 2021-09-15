import {
    ChangeDetectorRef,
    Component,
    Input,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { SidebarAppAdbService, IAmount, EAdbStatus } from '../services/service';
import { Session } from '../../../../controller/session/session';
import {
    NotificationsService,
    ENotificationType,
} from '../../../../services.injectable/injectable.service.notifications';
import { IAdbDevice, IAdbProcess } from '../../../../../../../../common/interfaces/interface.adb';
import { MatSelectChange } from '@angular/material/select';
import { IPCMessages } from '../../../../services/service.electron.ipc';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { sortPairs, IPair } from '../../../../thirdparty/code/engine';
import { Subscription, Observable, Subject } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

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
    @Input() public service: SidebarAppAdbService;

    public readonly _ng_noDevice: IAdbDevice = {
        name: '<No device selected>',
        type: '',
    };
    public _ng_devices: IAdbDevice[] = [this._ng_noDevice];
    public _ng_device: IAdbDevice = this._ng_noDevice;
    public readonly _ng_noProcess: IAdbProcess = {
        name: '<No process selected>',
        addr: undefined,
        pid: undefined,
        ppid: undefined,
        rss: undefined,
        s: undefined,
        user: undefined,
        vsz: undefined,
        wchan: undefined,
    };
    public _ng_processes: IAdbProcess[] = [this._ng_noProcess];
    public _ng_process: IAdbProcess = this._ng_noProcess;
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
    public _ng_logLevel: string = this._ng_logLevels[0].flag;
    public _ng_processSearchTerm: string = '';
    public _ng_processSelected: IPair = this._ng_noProcessPair;
    public _ng_processPairs: Observable<IPair[]>;
    public _ng_refreshDevices: boolean = false;
    public _ng_refreshProcesses: boolean = false;
    public _ng_scrollIntoViewTrigger: Subject<void> = new Subject();

    private _session: string;
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppAdbLogcatComponent');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _processPairs: IPair[] = [];
    private _processSearchTerm: Subject<string> = new Subject<string>();
    private _prevProcessSelected: IPair = this._ng_processSelected;

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _notifications: NotificationsService,
        private _sanitizer: DomSanitizer,
    ) {}

    public ngOnInit() {
        const session: Session = TabsSessionsService.getActive();
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
        this._init();
        this._ng_processPairs = this._processSearchTerm.pipe(
            startWith(''),
            map((value) => this._filter(value)),
        );
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onDeviceChange(event: MatSelectChange) {
        if (this._ng_device.name === this._ng_noDevice.name) {
            this._ng_processSelected = this._ng_noProcessPair;
            this._ng_process = this._ng_noProcess;
            this._ng_processes = [this._ng_noProcess];
            this._processPairs = [];
            this._stop();
            return;
        }
        this._start();
        this._ng_onRefreshProcesses();
    }

    public _ng_onRefreshDevices() {
        this._ng_refreshDevices = true;
        this.service
            .getDevices({ session: this._session })
            .then((response: IAdbDevice[]) => {
                this._ng_devices = [this._ng_noDevice, ...response];
                this._ng_refreshDevices = false;
            })
            .catch((error: Error) => {
                this._logger.error(`Failed to detect devices due error: ${error.message}`);
                this._ng_refreshDevices = false;
            });
    }

    public _ng_onRefreshProcesses() {
        this._ng_refreshProcesses = true;
        this._detectProcesses()
            .then(() => {
                this._ng_refreshProcesses = false;
            })
            .catch((error: Error) => {
                this._logger.error(error.message);
                this._ng_refreshProcesses = false;
            });
    }

    public _ng_onChange(event?: MatSelectChange) {
        if (this._ng_device.name === this._ng_noDevice.name) {
            return;
        }
        if (event !== undefined) {
            const processes: IAdbProcess | undefined = this._ng_processes.find(
                (process: IAdbProcess) => event.value.caption === process.name,
            );
            if (processes === undefined) {
                return;
            }
            this._ng_process = processes;
        }
        this.service
            .change({
                session: this._session,
                device: this._ng_device.name,
                level: this._ng_logLevel,
                pid: this._ng_process.pid,
            })
            .then(() => {
                this._ng_running = true;
            })
            .catch((error: Error) => {
                this._notifications.add({
                    caption: 'Fail to change loglevel',
                    message: `Failed to change adb settings for device ${this._ng_device.name} due to error: ${error.message}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
                this._logger.error(
                    `Failed to change adb settings for device ${this._ng_device.name} due to error: ${error.message}`,
                );
            });
    }

    public _ng_onFocus() {
        this._prevProcessSelected = this._ng_processSelected;
        this._ng_processSearchTerm = '';
        this._processSearchTerm.next(this._ng_processSearchTerm);
    }

    public _ng_onBlur() {
        this._ng_processSelected = this._prevProcessSelected;
        this._ng_processSearchTerm = '';
        this._processSearchTerm.next(this._ng_processSearchTerm);
    }

    public _ng_onCloseSearch() {
        this._ng_processSearchTerm = '';
        this._processSearchTerm.next(this._ng_processSearchTerm);
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
        this._processSearchTerm.next(this._ng_processSearchTerm);
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
        this.service.status = EAdbStatus.init;
        this._ng_devices = [this._ng_noDevice];
        this._ng_processes = [this._ng_noProcess];
        this._processPairs = [];
        this._ng_amount = this.service.bytesToString(0);
        this._ng_logLevel = this._ng_logLevels[0].flag;
        this._ng_device = this._ng_devices[0];
        this._ng_process = this._ng_processes[0];
        let devicesNeeded: boolean = false;
        // Try to restore first
        this._restore()
            .then((restored: boolean) => {
                devicesNeeded = !restored;
            })
            .catch((error: Error) => {
                this._logger.error(`Failed to restore session; error: ${error.message}`);
            })
            .finally(() => {
                if (devicesNeeded) {
                    this._ng_onRefreshDevices();
                } else {
                    this.service.status = EAdbStatus.ready;
                }
            });
    }

    private _restore(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.service
                .restore({ session: this._session })
                .then((response: IPCMessages.AdbLoadResponse) => {
                    if (this._session !== response.session) {
                        return resolve(false);
                    }
                    if (response.data.devices.length === 0) {
                        // This session wasn't stored. Probably new one
                        return resolve(false);
                    }
                    this._ng_amount = this.service.bytesToString(response.data.recieved);
                    this._ng_logLevel = response.data.logLevel;
                    this._ng_devices = [this._ng_noDevice, ...response.data.devices];
                    this._ng_processes = [this._ng_noProcess, ...response.data.processes];
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
                        this._ng_device = found === undefined ? this._ng_noDevice : found;
                    } else {
                        this._ng_device = this._ng_noDevice;
                    }
                    if (response.data.pid !== undefined) {
                        const found: IAdbProcess | undefined = this._ng_processes.find(
                            (process: IAdbProcess) => process.pid === response.data.pid,
                        );
                        this._ng_process = found === undefined ? this._ng_noProcess : found;
                    } else {
                        this._ng_process = this._ng_noProcess;
                    }
                    resolve(true);
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
        });
    }

    private _start() {
        this.service
            .start({
                session: this._session,
                device: this._ng_device.name,
                level: this._ng_logLevel,
                pid: this._ng_process.pid,
            })
            .then(() => {
                this._ng_running = true;
            })
            .catch((error: Error) => {
                this._notifications.add({
                    caption: 'Fail to start adb',
                    message: `Failed to start adb on device ${this._ng_device.name} due to error: ${error.message}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
                this._logger.error(
                    `Failed to start adb on device ${this._ng_device.name} due to error: ${error.message}`,
                );
            });
    }

    private _stop() {
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

    private _detectProcesses(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._ng_device.name === this._ng_noDevice.name) {
                this._processPairs = [];
                return resolve();
            }
            this.service
                .getProcesses({ session: this._session, device: this._ng_device.name })
                .then((response: IAdbProcess[]) => {
                    this._ng_processes.push(...response);
                    this._processPairs = [
                        ...response.map((process: IAdbProcess) => {
                            return {
                                caption: process.name,
                                description: ' ',
                                id: `${process.pid}`,
                            };
                        }),
                    ];
                    resolve();
                })
                .catch((error: Error) => {
                    reject(new Error(`Failed to detect processes due error: ${error.message}`));
                });
        });
    }

    private _onAmount(event: IAmount) {
        if (this._session !== event.session) {
            return;
        }
        this._ng_amount = event.amount;
        this._forceUpdate();
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
