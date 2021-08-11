import { Subscription } from 'rxjs';
import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { SidebarAppAdbService, IAmount, EAdbStatus } from '../services/service';
import { Session } from '../../../../controller/session/session';
import { NotificationsService, ENotificationType } from '../../../../services.injectable/injectable.service.notifications';
import { IAdbDevice, IAdbProcess } from '../../../../../../../../common/interfaces/interface.adb';
import { MatSelectChange } from '@angular/material/select';
import { IPCMessages } from '../../../../services/service.electron.ipc';

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
    styleUrls: ['./styles.less']
})

export class SidebarAppAdbLogcatComponent implements OnInit, OnDestroy {

    @Input() public service: SidebarAppAdbService;

    public readonly _ng_noDevice: IAdbDevice = {
        name: '<No device selected>',
        type: '',
    }
    public _ng_devices: IAdbDevice[] = [this._ng_noDevice];
    public _ng_device: IAdbDevice = this._ng_noDevice;
    public readonly _ng_noProcess: IAdbProcess = {
        name: '<No debuggable processes>',
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
        { name: 'Verbose', flag: 'V'},
        { name: 'Debug', flag: 'D'},
        { name: 'Info', flag: 'I'},
        { name: 'Warn', flag: 'W'},
        { name: 'Error', flag: 'E'},
        { name: 'Fatal', flag: 'F'},
        { name: 'Silent', flag: 'S'},
    ];
    public _ng_logLevel = this._ng_logLevels[0].flag;

    private _session: string;
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppAdbLogcatComponent');
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
    }

    public ngOnInit() {
        const session: Session = TabsSessionsService.getActive();
        if (session !== undefined) {
            this._session = session.getGuid();
        } else {
            this._logger.error('Session not available');
        }
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onAmount = this.service.getObservable().onAmount.subscribe(this._onAmount.bind(this));
        this._init();
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onDeviceChange(event: MatSelectChange) {
        if (this._ng_device.name === this._ng_noDevice.name) {
            this._ng_process = this._ng_noProcess;
            this._ng_processes = [this._ng_noProcess];
            this._stop();
            return;
        }
        this._start();
        this._detectProcesses().catch((error: string) => {
            this._logger.error(error);
        });
    }

    public _ng_onChange(event: MatSelectChange) {
        if (this._ng_device.name === this._ng_noDevice.name) {
            return;
        }
        this.service.change({ session: this._session, device: this._ng_device.name, level: this._ng_logLevel, pid: this._ng_process.pid }).then(() => {
            this._ng_running = true;
        }).catch((error: string) => {
            this._notifications.add({
                caption: 'Fail to change loglevel',
                message: `Failed to change adb settings for device ${this._ng_device.name} due to error: ${error}`,
                options: {
                    type: ENotificationType.error,
                },
            });
            this._logger.error(`Failed to change adb settings for device ${this._ng_device.name} due to error: ${error}`);
        });
    }

    private _init() {
        this.service.status = EAdbStatus.init;
        this._ng_devices = [this._ng_noDevice];
        this._ng_processes = [this._ng_noProcess];
        this._ng_amount = this.service.bytesToString(0);
        this._ng_logLevel = this._ng_logLevels[0].flag;
        this._ng_device = this._ng_devices[0];
        this._ng_process = this._ng_processes[0];
        let devicesNeeded: boolean = false;
        // Try to restore first
        this._restore().then((restored: boolean) => {
            devicesNeeded = !restored;
        }).catch((error: Error) => {
            this._logger.error(`Failed to restore session; error: ${error.message}`);
        }).finally(() => {
            if (devicesNeeded) {
                this.service.getDevices({ session: this._session }).then((response: IAdbDevice[]) => {
                    this._ng_devices = [this._ng_noDevice, ...response];
                }).catch((error: Error) => {
                    this._logger.error(`Failed to detect devices due error: ${error.message}`);
                });
            } else {
                this.service.status = EAdbStatus.ready;
            }
        })
    }

    private _restore(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.service.restore({ session: this._session }).then((response: IPCMessages.AdbLoadResponse) => {
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
                if (response.data.device !== undefined) {
                    this._ng_device = this._ng_devices.find((device: IAdbDevice) => device.name === response.data.device);
                } else {
                    this._ng_device = this._ng_noDevice;
                }
                if (response.data.pid !== undefined) {
                    this._ng_process = this._ng_processes.find((process: IAdbProcess) => process.pid === response.data.pid);
                } else {
                    this._ng_process = this._ng_noProcess;
                }
                resolve(true);
            }).catch(reject);
        });
    }

    private _start() {
        this.service.start({ session: this._session, device: this._ng_device.name, level: this._ng_logLevel, pid: this._ng_process.pid}).then(() => {
            this._ng_running = true;
        }).catch((error: string) => {
            this._notifications.add({
                caption: 'Fail to start adb',
                message: `Failed to start adb on device ${this._ng_device.name} due to error: ${error}`,
                options: {
                    type: ENotificationType.error,
                },
            });
            this._logger.error(`Failed to start adb on device ${this._ng_device.name} due to error: ${error}`);
        });
    }
    
    private _stop() {
        this.service.stop({ session: this._session }).then(() => {
            this._ng_running = false;
        }).catch((error: string) => {
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
                return resolve();
            }
            this.service.getProcesses({ session: this._session, device: this._ng_device.name }).then((response: IAdbProcess[]) => {
                this._ng_processes.push(...response);
                resolve();
            }).catch((error: string) => {
                reject(`Failed to detect processes due error: ${error}`);
            });
        })
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
