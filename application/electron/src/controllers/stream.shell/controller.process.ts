// tslint:disable: no-unused-expression
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { IPCMessages as IPC, Subscription } from '../../services/service.electron';

import ServiceElectron from '../../services/service.electron';
import ServiceStreamSource from '../../services/service.stream.sources';
import ServiceStreams from '../../services/service.streams';

import Logger from '../../tools/env.logger';

export interface IForkSettings {
    env: { [key: string]: string };
    shell: string | boolean;
    pwd: string;
}

export interface ICommand {
    cmd: string;
    guid: string;
    settings: IForkSettings;
}

export default class Process extends EventEmitter {

    public static Events = {
        destroy: 'destroy'
    };

    public Events = Process.Events;

    private _session: string;
    private _process: ChildProcess | undefined;
    private _command: ICommand;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Logger;
    private _stat: IPC.IShellProcessStat = {
        created: 0,
        recieved: 0,
        terminated: 0,
        pid: 0,
    };
    private _meta: IPC.IShellProcessMeta = {
        sourceId: 0,
        color: '',
    };

    constructor(session: string, command: ICommand) {
        super();
        this._session = session;
        this._command = command;
        this._logger = new Logger(`Shell process "${command.guid}"`);
        ServiceElectron.IPC.subscribe(IPC.ShellProcessDetailsRequest, (this._ipc_ShellProcessDetailsRequest.bind(this) as any)).then((subscription: Subscription) => {
            this._subscriptions.ShellProcessDetailsRequest = subscription;
        }).catch((err: Error) =>  this._logger.error(`Fail to subscribe to ShellProcessDetailsRequest due error: ${err.message}`));
        ServiceElectron.IPC.subscribe(IPC.ShellProcessKillRequest, (this._ipc_ShellProcessKillRequest.bind(this) as any)).then((subscription: Subscription) => {
            this._subscriptions.ShellProcessKillRequest = subscription;
        }).catch((err: Error) =>  this._logger.error(`Fail to subscribe to ShellProcessKillRequest due error: ${err.message}`));
    }

    public execute() {
        if (this._process !== undefined) {
            return this._logger.error(`Attempt to start process, which already was started`);
        }
        this._meta.sourceId = ServiceStreamSource.add({
            name: this._command.cmd,
            session: this._session,
        });
        this._process = spawn(this._command.cmd, {
            cwd: this._command.settings.pwd,
            env: this._command.settings.env,
            shell: this._command.settings.shell,
        });
        this._stat.created = Date.now();
        this._stat.pid = this._process.pid;
        this._stat.recieved = 0;
        this._process.stdout !== null && this._process.stdout.on('data', this._onData.bind(this));
        this._process.stderr !== null && this._process.stderr.on('data', this._onData.bind(this));
        this._process.on('exit', this._onDone.bind(this));
        this._process.on('close', this._onDone.bind(this));
        this._process.on('disconnect', this._onDone.bind(this));
        this._process.on('error', this._onDone.bind(this));
        ServiceElectron.IPC.send(new IPC.ShellProcessStartedEvent({
            session: this._session,
            guid: this._command.guid,
        })).catch(err => this._logger.warn(`Fail to send ShellProcessStartedEvent due error ${err.message}`));
    }

    public getInfo(): IPC.IShellProcess {
        return {
            guid: this._command.guid,
            command: this._command.cmd,
            stat: this._stat,
            meta: this._meta,
            env: this._command.settings.env,
            pwd: this._command.settings.pwd,
        };
    }
/*
    public write(data: any): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._process === undefined) {
                return reject(new Error(`Shell process isn't available. It was destroyed or wasn't created at all.`));
            }
            this._process.stdin.write(data, (error: Error | null | undefined) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    }
*/
    public destroy(): Error | undefined {
        if (this._process === undefined) {
            return new Error(this._logger.error(`Attempt to destroy child process, which isn't created or was destroyed.`));
        }
        this._process.removeAllListeners();
        if (this._process.stdout !== null) {
            this._process.stdout.removeAllListeners();
            this._process.stdout.destroy();
        }
        if (this._process.stderr !== null) {
            this._process.stderr.removeAllListeners();
            this._process.stderr.destroy();
        }
        this._process.kill();
        this._process = undefined;
        this.emit(this.Events.destroy);
        this.removeAllListeners();
    }

    private _onData(chunk: any) {
        if (this._process === undefined) {
            return;
        }
        if (typeof chunk === 'string') {
            // Here should be for sure, not string length, but byteLength.
            // To get byteLength we have to create a Buffer and here is a
            // preformance question. Well, let it be for now length of string;
            this._stat.recieved += chunk.length;
        } else if (chunk instanceof Buffer) {
            this._stat.recieved += chunk.byteLength;
        }
        ServiceStreams.writeTo(chunk, this._meta.sourceId, undefined, this._session).catch((err: Error) => {
            this._logger.error(`Fail to write a chunk into stream ${this._session}`);
        });
    }

    private _onDone(error?: Error) {
        if (error instanceof Error) {
            this._onData(error.message);
        }
        this.destroy();
    }

    private _ipc_ShellProcessKillRequest(request: IPC.ShellProcessKillRequest, response: (response: IPC.ShellProcessKillResponse) => Promise<void>) {
        if (request.guid !== this._command.guid) {
            return;
        }
        const error: Error | undefined = this.destroy();
        response(new IPC.ShellProcessKillResponse({
            error: error !== undefined ? error.message : undefined,
        }));
    }

    private _ipc_ShellProcessDetailsRequest(request: IPC.ShellProcessDetailsRequest, response: (response: IPC.ShellProcessDetailsResponse) => Promise<void>) {
        if (request.guid !== this._command.guid) {
            return;
        }
        response(new IPC.ShellProcessDetailsResponse({
            info: this.getInfo(),
        }));
    }


}