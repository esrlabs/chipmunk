import * as pty from 'node-pty';
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

    private _process: pty.IPty | undefined;

    constructor(options: IShellOptions) {
        super();
        this._process = pty.spawn(options.shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: process.env.HOME,
            env: process.env as any
        });
        this._process.on('data', this._onStdout.bind(this));
        this._process.on('exit', this._onExit.bind(this));
    }

    public send(data: any): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._process === undefined) {
                return reject(new Error(`Shell process isn't available. It was destroyed or wasn't created at all.`));
            }
            this._process.write(data);
            resolve();
        });
    }

    public destroy() {
        if (this._process === undefined) {
            return;
        }
        this._process.kill();
    }

    private _onStdout(chunk: any) {
        this.emit(this.Events.data, chunk);
    }

    private _onExit() {
        this.destroy();
        this.emit(this.Events.exit);
    }

}