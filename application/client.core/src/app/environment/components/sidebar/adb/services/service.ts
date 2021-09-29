import { Observable, Subject, Subscription } from 'rxjs';
import { IAdbDevice, IAdbProcess } from '../../../../../../../../common/interfaces/interface.adb';

import ElectronIpcService, { IPC } from '../../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IAmount {
    guid: string;
    amount: string;
}

export enum EAdbStatus {
    init = 'init',
    ready = 'ready',
    error = 'error',
}

export class SidebarAppAdbService {
    private _status: EAdbStatus = EAdbStatus.init;
    private _errorMessage: string = '';
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _subjects: {
        onAmount: Subject<IAmount>;
        onDisconnect: Subject<IPC.IAdbDeviceDisconnected>;
    } = {
        onAmount: new Subject<IAmount>(),
        onDisconnect: new Subject<IPC.IAdbDeviceDisconnected>(),
    };

    constructor() {
        this._subscriptions.AdbStreamUpdated = ElectronIpcService.subscribe(
            IPC.AdbStreamUpdated,
            this._onAdbStreamUpdated.bind(this),
        );
        this._subscriptions.AdbDeviceDisconnected = ElectronIpcService.subscribe(
            IPC.AdbDeviceDisconnected,
            this._onAdbDeviceDisconnected.bind(this),
        );
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public getObservable(): {
        onAmount: Observable<IAmount>;
        onDisconnect: Observable<IPC.IAdbDeviceDisconnected>;
    } {
        return {
            onAmount: this._subjects.onAmount.asObservable(),
            onDisconnect: this._subjects.onDisconnect.asObservable(),
        };
    }

    public set status(status: EAdbStatus) {
        this._status = status;
    }

    public get status(): EAdbStatus {
        return this._status;
    }

    public get errorMessage(): string {
        return this._errorMessage;
    }

    public prepare(request: IPC.IAdbStartServerRequest): Promise<void> {
        this._status = EAdbStatus.init;
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.AdbStartServerResponse>(
                new IPC.AdbStartServerRequest(request),
                IPC.AdbStartServerResponse,
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        this._errorMessage = response.error;
                        this._status = EAdbStatus.error;
                        return reject(new Error(response.error));
                    }
                    this._status = EAdbStatus.ready;
                    resolve();
                })
                .catch((error: Error) => {
                    this._errorMessage = error.message;
                    this._status = EAdbStatus.error;
                    reject(error);
                });
        });
    }

    public getDevices(request: IPC.IAdbDevicesRequest): Promise<IAdbDevice[]> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.AdbDevicesResponse>(
                new IPC.AdbDevicesRequest(request),
                IPC.AdbDevicesResponse,
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        return reject(new Error(response.error));
                    }
                    if (response.devices === undefined) {
                        return reject(new Error(`AdbDevicesResponse returns invalid response`));
                    }
                    resolve(response.devices);
                })
                .catch((error: Error) => {
                    reject(error);
                });
        });
    }

    public getProcesses(request: IPC.IAdbProcessesRequest): Promise<IAdbProcess[]> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.AdbProcessesResponse>(
                new IPC.AdbProcessesRequest(request),
                IPC.AdbProcessesResponse,
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        return reject(new Error(response.error));
                    }
                    if (response.processes === undefined) {
                        return reject(new Error(`AdbProcessesResponse returns invalid response`));
                    }
                    resolve(response.processes);
                })
                .catch((error: Error) => {
                    reject(error);
                });
        });
    }

    public start(request: IPC.IAdbStartRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPC.AdbStartRequest(request), IPC.AdbStartResponse)
                .then((response: IPC.AdbStartResponse) => {
                    resolve();
                })
                .catch((error: Error) => {
                    reject(error);
                });
        });
    }

    public stop(request: IPC.IAdbStopRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPC.AdbStopRequest(request), IPC.AdbStopResponse)
                .then((response: IPC.AdbStopResponse) => {
                    if (response.error !== undefined) {
                        return reject(new Error(response.error));
                    }
                    resolve();
                })
                .catch((error: Error) => {
                    reject(error);
                });
        });
    }

    public change(request: IPC.IAdbStartRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            this.start(request)
                .then(() => {
                    resolve();
                })
                .catch((error: Error) => {
                    reject(error);
                });
        });
    }

    public restore(request: IPC.IAdbLoadRequest): Promise<IPC.AdbLoadResponse> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.AdbLoadResponse>(
                new IPC.AdbLoadRequest(request),
                IPC.AdbLoadResponse,
            )
                .then((response) => {
                    resolve(response);
                })
                .catch((error: Error) => {
                    reject(error);
                });
        });
    }

    public bytesToString(amount: number): string {
        if (amount < 1024) {
            return `${amount} bytes`;
        } else if (amount / 1024 < 1024) {
            return `${(amount / 1024).toFixed(2)} kB`;
        } else if (amount / 1024 / 1024 < 1024 * 1024) {
            return `${(amount / 1024 / 1024).toFixed(4)} Mb`;
        } else {
            return `${(amount / 1024 / 1024 / 1024).toFixed(5)} Gb`;
        }
    }

    private _onAdbStreamUpdated(response: IPC.AdbStreamUpdated) {
        this._subjects.onAmount.next({
            guid: response.guid,
            amount: this.bytesToString(response.amount),
        });
    }

    private _onAdbDeviceDisconnected(response: IPC.AdbDeviceDisconnected) {
        this._subjects.onDisconnect.next({
            guid: response.guid,
            device: response.device,
        });
    }
}
