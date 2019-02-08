import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface IShellOptions {
    shell: string;
}

export default class Shell extends EventEmitter {
    
    public static Events = {
        data: 'data',
        exit: 'exit',
        error: 'error'
    };

    public Events = Shell.Events;

    private _process: ChildProcess | undefined;

    constructor(options: IShellOptions) {
        super();
        this._process = spawn(options.shell);
        this._process.stdout.on('data', this._onStdout.bind(this));
        this._process.stderr.on('data', this._onStderr.bind(this));
        this._process.on('exit', this._onExit.bind(this));
        this._process.on('close', this._onClose.bind(this));
        this._process.on('disconnect', this._onDisconnect.bind(this));
        this._process.on('error', this._onError.bind(this));
    }

    public send(data: any): Promise<void> {
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
        if (this._process === undefined) {
            return;
        }
        this._process.removeAllListeners();
        this._process.kill();
    }

    private _onStdout(chunk: any) {
        this.emit(this.Events.data, chunk);
    }

    private _onStderr(chunk: any) {
        this.emit(this.Events.data, chunk);
    }

    private _onExit() {
        this.destroy();
        this.emit(this.Events.exit);
    }

    private _onClose() {
        this.destroy();
        this.emit(this.Events.exit);
    }

    private _onDisconnect() {
        this.destroy();
        this.emit(this.Events.exit);
    }

    private _onError(error: Error) {
        this.destroy();
        this.emit(this.Events.error, error);
    }

}