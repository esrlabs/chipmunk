import { IPCMessages as IPC, Subscription } from '../../services/service.electron';
import { getEnvVars, getDefShell, getShells, TEnvVars } from 'chipmunk.shell.env';

import ServiceStorage from '../../services/service.storage';
import Process from './controller.process';
import ServiceElectron from '../../services/service.electron';

import Logger from '../../tools/env.logger';

import * as Tools from '../../tools/index';
import * as path from 'path';
import * as os from 'os';
import * as FS from '../../tools/fs';

export default class ControllerStreamShell {

    private _logger: Logger;
    private _guid: string;
    private _running: Map<string, Process> = new Map();
    private _terminated: Map<string, Process> = new Map();
    private _subscriptions: { [key: string]: Subscription } = {};
    private _env: {
        env: { [key: string]: string };
        shell: string;
        shells: string[];
        pwd: string;
    } = {
        env: {},
        shell: '',
        shells: [],
        pwd: path.normalize(`${os.homedir()}`),
    };

    constructor(guid: string) {
        this._guid = guid;
        this._logger = new Logger(`ControllerStreamShell: ${guid}`);
        let error: Error | undefined;
        // This controller should not block loading of app. Even initialization is failed, it
        // should not throw an exception.
        Promise.all([
            getEnvVars().then((_: TEnvVars) => {
                this._env.env = _;
            }).catch(e => error = e),
            getShells().then((_: string[]) => {
                this._env.shells = _;
            }).catch(e => error = e),
            getDefShell().then((_: string) => {
                this._env.shell = _;
            }).catch(e => error = e),
        ]).then(() => {
            if (error !== undefined) {
                this._logger.error(`Fail to correctly load envvars due error: ${error.message}`);
            }
            this._logger.verbose(`Next envvars are detected:\n\t${Object.keys(this._env.env).map(k => k + ' = ' + this._env.env[k]).filter(v => v.trim() !== '=').join('\n\t')}`);
            this._logger.verbose(`Next shells are detected:\n\t${this._env.shells.join('\n\t')}`);
            this._logger.verbose(`Current shell is:\n\t${this._env.shell}`);
            this._logger.verbose(`Current pwd is:\n\t${this._env.pwd}`);
            ServiceElectron.IPC.subscribe(IPC.ShellEnvRequest, (this._ipc_ShellEnvRequest.bind(this) as any)).then((subscription: Subscription) => {
                this._subscriptions.ShellEnvRequest = subscription;
            }).catch((err: Error) =>  this._logger.error(`Fail to subscribe to ShellEnvRequest due error: ${err.message}`));
            ServiceElectron.IPC.subscribe(IPC.ShellProcessListRequest, (this._ipc_ShellProcessListRequest.bind(this) as any)).then((subscription: Subscription) => {
                this._subscriptions.ShellProcessListRequest = subscription;
            }).catch((err: Error) =>  this._logger.error(`Fail to subscribe to ShellProcessListRequest due error: ${err.message}`));
            ServiceElectron.IPC.subscribe(IPC.ShellSetEnvRequest, (this._ipc_ShellSetEnvRequest.bind(this) as any)).then((subscription: Subscription) => {
                this._subscriptions.ShellSetEnvRequest = subscription;
            }).catch((err: Error) =>  this._logger.error(`Fail to subscribe to ShellSetEnvRequest due error: ${err.message}`));
            ServiceElectron.IPC.subscribe(IPC.ShellProcessRunRequest, (this._ipc_ShellProcessRunRequest.bind(this) as any)).then((subscription: Subscription) => {
                this._subscriptions.ShellProcessRunRequest = subscription;
            }).catch((err: Error) =>  this._logger.error(`Fail to subscribe to ShellProcessRunRequest due error: ${err.message}`));
            ServiceElectron.IPC.subscribe(IPC.ShellProcessTerminatedListRequest, (this._ipc_ShellProcessTerminatedListRequest.bind(this) as any)).then((subscription: Subscription) => {
                this._subscriptions.ShellProcessTerminatedListRequest = subscription;
            }).catch((err: Error) =>  this._logger.error(`Fail to subscribe to ShellProcessTerminatedListRequest due error: ${err.message}`));
        }).catch((err: Error) => {
            this._logger.error(`Unexpecting error on load envvars: ${err.message}`);
        });
    }

    public destroy(): Promise<void> {
        this._running.forEach((proc: Process) => {
            proc.removeAllListeners();
            proc.destroy();
        });
        this._running.clear();
        this._terminated.clear();
        return Promise.resolve();
    }

    private _ipc_ShellProcessRunRequest(request: IPC.ShellProcessRunRequest, response: (response: IPC.ShellProcessRunResponse) => Promise<void>) {
        const sendListOfRunning = () => {
            ServiceElectron.IPC.send(new IPC.ShellProcessListEvent({
                session: this._guid,
                processes: Array.from(this._running.values()).map(p => p.getInfo()),
            }));
        };
        const sendListOfTerminated = () => {
            ServiceElectron.IPC.send(new IPC.ShellProcessStoppedEvent({
                session: this._guid,
                processes: Array.from(this._terminated.values()).map(p => p.getInfo()),
            }));
        };
        const stored: string[] = ServiceStorage.get().get().recentCommands;
        if (stored.indexOf(request.command) === -1) {
            stored.unshift(request.command);
            ServiceStorage.get().set({
                recentCommands: stored,
            }).catch((err: Error) => {
                this._logger.error(`Failed to save command as recent due error: ${err.message}`);
            });
        }
        if (request.session !== this._guid) {
            return;
        }
        const guid: string = Tools.guid();
        const proc: Process = new Process(this._guid, {
            guid: guid,
            cmd: request.command,
            settings: {
                env: this._env.env,
                pwd: this._env.pwd,
                shell: this._env.shell,
            }
        });
        proc.on(Process.Events.destroy, () => {
            proc.removeAllListeners();
            proc.getInfo().stat.terminated = (Date.now() - proc.getInfo().stat.created);
            this._terminated.set(guid, proc);
            this._running.delete(guid);
            sendListOfTerminated();
            sendListOfRunning();
        });
        this._running.set(guid, proc);
        proc.execute();
        response(new IPC.ShellProcessRunResponse({})).finally(() => {
            sendListOfRunning();
        });
    }

    private _ipc_ShellSetEnvRequest(request: IPC.ShellSetEnvRequest, response: (response: IPC.ShellSetEnvResponse) => Promise<void>) {
        if (request.session !== this._guid) {
            return;
        }
        if (request.shell !== undefined && this._env.shells.indexOf(request.shell) === -1) {
            return response(new IPC.ShellSetEnvResponse({
                error: `Fail to find shell "${request.shell}". Available shells: ${this._env.shells.join('; ')}`,
            }));
        }
        (new Promise((resolve, reject) => {
            if (request.pwd === undefined) {
                return resolve(undefined);
            } else {
                FS.exist(request.pwd).then((exist: boolean) => {
                    if (exist) {
                        resolve(undefined);
                    } else {
                        reject(new Error(`Path "${request.pwd}" doesn't exist`));
                    }
                }).catch(reject);
            }
        })).then(() => {
            this._env.pwd = request.pwd !== undefined ? request.pwd : this._env.pwd;
            this._env.shell = request.shell !== undefined ? request.shell : this._env.shell;
            this._env.env = request.env !== undefined ? request.env : this._env.env;
            response(new IPC.ShellSetEnvResponse({ }));
        }).catch((err: Error) => {
            response(new IPC.ShellSetEnvResponse({
                error: err.message,
            }));
        });
    }

    private _ipc_ShellProcessListRequest(request: IPC.ShellProcessListRequest, response: (response: IPC.ShellProcessListResponse) => Promise<void>) {
        if (request.session !== this._guid) {
            return;
        }
        response(new IPC.ShellProcessListResponse({
            session: this._guid,
            processes: Array.from(this._running.values()).map(proc => proc.getInfo()),
        }));
    }

    private _ipc_ShellEnvRequest(request: IPC.ShellEnvRequest, response: (response: IPC.ShellEnvResponse) => Promise<void>) {
        if (request.session !== this._guid) {
            return;
        }
        response(new IPC.ShellEnvResponse({
            env: this._env.env,
            shell: this._env.shell,
            shells: this._env.shells,
            pwd: this._env.pwd,
        }));
    }

    private _ipc_ShellProcessTerminatedListRequest(request: IPC.ShellProcessTerminatedListRequest, response: (response: IPC.ShellProcessTerminatedListResponse) => Promise<void>) {
        if (request.session !== this._guid) {
            return;
        }
        response(new IPC.ShellProcessTerminatedListResponse({
            session: this._guid,
            processes: Array.from(this._terminated.values()).map(proc => proc.getInfo()),
        }));
    }

}