import { spawn, ChildProcess, ExecOptions } from 'child_process';
import { EventEmitter } from 'events';

import ServiceEnv from '../../services/service.env';
import ServiceStreams from '../../services/service.streams';
import ServiceStreamSources from '../../services/service.stream.sources';
import StreamUpdatesPostman from './postman';

import Logger from '../../tools/env.logger';

interface ICommand {
    device: string;
    level: string;
    guid: string;
    pid?: number;
}

interface ICommandComponent {
    command: string;
    flags: string[];
}

export interface IProcessMeta {
    sourceId: number;
    color: string;
}

export default class Process extends EventEmitter {

    public static Events = {
        destroy: 'destroy',
        recieved: 'recieved',
    };

    public Events = Process.Events;

    private _session: string;
    private _process: ChildProcess | undefined;
    private _command: ICommand;
    private _logger: Logger;
    private _meta: IProcessMeta = {
        sourceId: 0,
        color: '',
    };
    private _received: number = 0;
    private _postman: StreamUpdatesPostman;

    constructor(session: string, command: ICommand) {
        super();
        this._session = session;
        this._command = command;
        this._logger = new Logger(`Adb process "${command.guid}"`);
        this._postman = new StreamUpdatesPostman(session);
    }

    public execute() {
        if (this._process !== undefined) {
            return this._logger.error(`Attempt to start process, which already was started`);
        }
        this._meta.sourceId = ServiceStreamSources.add({
            name: `${this._command.device}:${this._command.level}`,
            session: this._session,
        });
        const spawnCmd: ICommandComponent = this._generateCommand(this._command.device, this._command.level, this._command.pid);
        this._process = spawn(spawnCmd.command, spawnCmd.flags, this._getExecOpts());
        if (this._process.stdout !== null) {
            this._process.stdout.on('data', this._onData.bind(this));
        }
        if (this._process.stderr !== null) {
            this._process.stderr.on('data', this._onData.bind(this));
        }
        this._process.on('exit', this._onDone.bind(this));
        this._process.on('close', this._onDone.bind(this));
        this._process.on('disconnect', this._onDone.bind(this));
        this._process.on('error', this._onDone.bind(this));
    }

    public destroy(): Error | undefined {
        this._postman.destroy();
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
        const received = typeof chunk === 'string' ? chunk.length : (chunk instanceof Buffer ? chunk.byteLength : 0);
        this._received += received;
        this.emit(this.Events.recieved, received);
        ServiceStreams.writeTo(chunk, this._meta.sourceId, undefined, this._session).catch((err: Error) => {
            this._logger.error(`Fail to write a chunk into stream ${this._session}`);
        });
        this._postman.notification(this._received);
    }

    private _onDone(error?: Error) {
        if (error instanceof Error) {
            this._onData(error.message);
        }
        this.destroy();
    }

    private _generateCommand(device: string, level: string, pid?: number): ICommandComponent {
        const processId: string = pid === undefined ? '' : `--pid=${pid}`;
        return {command: 'adb', flags: ['-s', device, 'logcat', processId, `*:${level}`]};
    }

    private _getExecOpts(): ExecOptions {
        return {
            env: ServiceEnv.getOS(),
        };
    }

}
