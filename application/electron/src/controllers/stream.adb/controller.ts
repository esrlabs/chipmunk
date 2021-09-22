import { IPCMessages as IPC, Subscription } from '../../services/service.electron';
import { exec, ExecException, ExecOptions } from 'child_process';
import { IAdbProcess, IAdbDevice, IAdbSession } from '../../../../common/interfaces/interface.adb';

import Process from './controller.process';
import ServiceElectron from '../../services/service.electron';
import ServiceEnv from '../../services/service.env';
import Logger from '../../tools/env.logger';

import * as Tools from '../../tools/index';

export default class ControllerStreamAdb {
    private _logger: Logger;
    private _guid: string;
    private _process?: Process;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _session: IAdbSession = {
        devices: [],
        processes: [],
        device: undefined,
        pid: undefined,
        logLevel: 'V',
        recieved: 0,
    };

    constructor(guid: string) {
        this._guid = guid;
        this._logger = new Logger(`ControllerStreamAdb: ${guid}`);
        ServiceElectron.IPC.subscribe(
            IPC.AdbStartRequest,
            this._ipc_AdbStartRequest.bind(this) as any,
        )
            .then((subscription: Subscription) => {
                this._subscriptions.AdbStartRequest = subscription;
            })
            .catch((err: Error) =>
                this._logger.error(
                    `Fail to subscribe to AdbStartRequest due error: ${err.message}`,
                ),
            );
        ServiceElectron.IPC.subscribe(
            IPC.AdbProcessesRequest,
            this._ipc_AdbProcessesRequest.bind(this) as any,
        )
            .then((subscription: Subscription) => {
                this._subscriptions.AdbProcessesRequest = subscription;
            })
            .catch((err: Error) =>
                this._logger.error(
                    `Fail to subscribe to AdbProcessesRequest due error: ${err.message}`,
                ),
            );
        ServiceElectron.IPC.subscribe(
            IPC.AdbDevicesRequest,
            this._ipc_AdbDevicesRequest.bind(this) as any,
        )
            .then((subscription: Subscription) => {
                this._subscriptions.AdbDevicesRequest = subscription;
            })
            .catch((err: Error) =>
                this._logger.error(
                    `Fail to subscribe to AdbDevicesRequest due error: ${err.message}`,
                ),
            );
        ServiceElectron.IPC.subscribe(
            IPC.AdbLoadRequest,
            this._ipc_AdbLoadRequest.bind(this) as any,
        )
            .then((subscription: Subscription) => {
                this._subscriptions.AdbLoadRequest = subscription;
            })
            .catch((err: Error) =>
                this._logger.error(`Fail to subscribe to AdbLoadRequest due error: ${err.message}`),
            );
        ServiceElectron.IPC.subscribe(
            IPC.AdbStopRequest,
            this._ipc_AdbStopRequest.bind(this) as any,
        )
            .then((subscription: Subscription) => {
                this._subscriptions.AdbStopRequest = subscription;
            })
            .catch((err: Error) =>
                this._logger.error(`Fail to subscribe to AdbStopRequest due error: ${err.message}`),
            );
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            this._kill();
            resolve();
        });
    }

    private _ipc_AdbStartRequest(
        request: IPC.AdbStartRequest,
        response: (response: IPC.AdbStartResponse) => Promise<void>,
    ) {
        if (request.session !== this._guid) {
            return;
        }
        this._kill();
        this._session.device = request.device;
        this._session.logLevel = request.level;
        this._session.pid = request.pid;
        const guid: string = Tools.guid();
        this._process = new Process(this._guid, {
            guid: guid,
            device: request.device,
            level: request.level,
            pid: request.pid,
        });
        this._process.on(Process.Events.destroy, () => {
            if (this._process !== undefined) {
                this._process.removeAllListeners();
                ServiceElectron.IPC.send(
                    new IPC.AdbDeviceDisconnected({
                        guid: this._guid,
                        device: request.device,
                    }),
                );
            }
        });
        this._process.on(Process.Events.recieved, (recieved) => {
            this._session.recieved += recieved;
        });
        this._process.execute();
        response(new IPC.AdbStartResponse({ guid: guid }));
    }

    private _ipc_AdbStopRequest(
        request: IPC.AdbStopRequest,
        response: (response: IPC.AdbStopResponse) => Promise<void>,
    ) {
        if (request.session !== this._guid) {
            return;
        }
        const error: Error | undefined = this._kill();
        this._session.device = undefined;
        this._session.pid = undefined;
        this._session.recieved = 0;
        response(
            new IPC.AdbStopResponse({ error: error !== undefined ? error.message : undefined }),
        );
    }

    private _ipc_AdbProcessesRequest(
        request: IPC.AdbProcessesRequest,
        response: (response: IPC.AdbProcessesResponse) => Promise<void>,
    ) {
        if (request.session !== this._guid) {
            return;
        }
        exec(
            `adb -s ${request.device} shell ps -A`,
            this._getExecOpts(),
            (error: ExecException | null, stdout: string, stderr: string) => {
                if (error || stderr) {
                    return response(
                        new IPC.AdbDevicesResponse({ error: error ? error.message : stderr }),
                    );
                }

                let match: RegExpExecArray | null;
                const split: string[] = stdout.split(/[\n\r]/g);
                const processes: IAdbProcess[] = [];
                const reg =
                    /(\w+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\w+)\s+\[??(.+)\]?\s*$/g;
                split.forEach((line: string) => {
                    match = reg.exec(line);
                    if (match !== null) {
                        processes.push({
                            user: match[1].toString(),
                            pid: this._toNumber(match[2]),
                            ppid: this._toNumber(match[3]),
                            vsz: this._toNumber(match[4]),
                            rss: this._toNumber(match[5]),
                            wchan: this._toNumber(match[6]),
                            addr: this._toNumber(match[7]),
                            s: match[8],
                            name: match[9],
                        });
                    }
                });
                this._session.processes = processes;
                return response(new IPC.AdbProcessesResponse({ processes: processes }));
            },
        );
    }

    private _ipc_AdbDevicesRequest(
        request: IPC.AdbDevicesRequest,
        response: (response: IPC.AdbDevicesResponse) => Promise<void>,
    ) {
        if (request.session !== this._guid) {
            return;
        }
        exec(
            'adb devices',
            this._getExecOpts(),
            (error: ExecException | null, stdout: string, stderr: string) => {
                if (error || stderr) {
                    return response(
                        new IPC.AdbDevicesResponse({ error: error ? error.message : stderr }),
                    );
                }
                let match: RegExpExecArray | null;
                const split: string[] = stdout.split(/[\n\r]/g);
                const devices: IAdbDevice[] = [];
                const reg = /(.*)\t(.*)/g;
                split.forEach((line: string) => {
                    match = reg.exec(line);
                    if (match !== null) {
                        devices.push({
                            name: match[1],
                            type: match[3],
                        });
                    }
                });
                this._session.devices = devices;
                return response(new IPC.AdbDevicesResponse({ devices: devices }));
            },
        );
    }

    private _ipc_AdbLoadRequest(
        request: IPC.AdbLoadRequest,
        response: (response: IPC.AdbLoadResponse) => Promise<void>,
    ) {
        if (request.session !== this._guid) {
            return;
        }
        response(
            new IPC.AdbLoadResponse({
                session: this._guid,
                data: this._session,
            }),
        );
    }

    private _toNumber(input: string): number | undefined {
        const int: number = parseInt(input, 10);
        return !isNaN(int) && isFinite(int) ? int : undefined;
    }

    private _getExecOpts(): ExecOptions {
        return {
            env: ServiceEnv.getOS(),
        };
    }

    private _kill() {
        if (this._process !== undefined) {
            this._process.removeAllListeners();
            const error: Error | undefined = this._process.destroy();
            this._process = undefined;
            this._session.recieved = 0;
            if (error) {
                this._logger.warn(`Problems with killing process: ${error.message}`);
            }
            return error;
        } else {
            return undefined;
        }
    }
}
