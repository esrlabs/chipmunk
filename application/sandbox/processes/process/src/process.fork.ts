import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface IForkSettings {
    env: { [key: string]: string };
    shell: string | boolean;
    cwd: string;
}

export interface ICommand {
    cmd: string;
    settings: IForkSettings;
}

export default class Fork extends EventEmitter {
    
    public static Events = {
        data: 'data',
        exit: 'exit'
    };

    public Events = Fork.Events;

    private _process: ChildProcess | undefined;
    private _closed: boolean = true;
    private _command: ICommand;

    constructor(command: ICommand) {
        super();
        this._command = command;
    }

    public execute() {
        this._process = spawn(this._command.cmd, {
            cwd: this._command.settings.cwd,
            env: this._command.settings.env,
            shell: this._command.settings.shell,
        });
        this._closed = false;
        this._process.stdout.on('data', this._onStdout.bind(this));
        this._process.stderr.on('data', this._onStderr.bind(this));
        this._process.on('exit', this._onExit.bind(this));
        this._process.on('close', this._onClose.bind(this));
        this._process.on('disconnect', this._onDisconnect.bind(this));
        this._process.on('error', this._onError.bind(this));
    }

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

    public destroy() {
        this._closed = true;
        if (this._process === undefined) {
            return;
        }
        this.removeAllListeners();
        this._process.removeAllListeners();
        this._process.kill();
        this._process = undefined;
    }

    public isClosed(): boolean {
        return this._closed;
    }

    private _onStdout(chunk: any) {
        this.emit(this.Events.data, chunk);
    }

    private _onStderr(chunk: any) {
        this.emit(this.Events.data, chunk);
    }

    private _onExit() {
        this.emit(this.Events.exit);
        this.destroy();
    }

    private _onClose() {
        this.emit(this.Events.exit);
        this.destroy();
    }

    private _onDisconnect() {
        this.emit(this.Events.exit);
        this.destroy();
    }

    private _onError(error: Error) {
        this.emit(this.Events.data, error.message);
        this.emit(this.Events.exit);
        this.destroy();
    }

}