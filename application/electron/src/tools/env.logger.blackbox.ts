import * as FS from "./fs";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

enum EState {
    locked = "locked",
    ready = "ready",
    writing = "writing",
    shutdown = "shutdown",
}

type TShutdownHandler = () => void;

export class LogsBlackbox {
    private _homeFolder: string = path.resolve(os.homedir(), ".chipmunk");
    private _logFile: string = path.resolve(os.homedir(), ".chipmunk/chipmunk.log");
    private _buffer: string[] = [];
    private _state: EState = EState.locked;
    private _shutdownHandler: TShutdownHandler | undefined;

    constructor() {
        this._init();
    }

    public write(msg?: string) {
        if (this._state === EState.shutdown) {
            return;
        }
        if ((typeof msg !== "string" || msg.trim() === "") && this._buffer.length === 0) {
            // Nothing to write
            return;
        }
        if (typeof msg === "string" && msg.trim() !== "" && this._state !== EState.ready) {
            // Cannot write for now
            this._buffer.push(msg);
            return;
        }
        if (typeof msg === "string" && msg.trim() !== "") {
            this._buffer.push(msg);
        }
        if (this._buffer.length === 0) {
            // Nothing to write
            return;
        }
        this._state = EState.writing;
        msg = this._buffer.join("\n");
        this._buffer = [];
        fs.appendFile(
            this._logFile,
            `${msg}\n`,
            { encoding: "utf8" },
            (error: NodeJS.ErrnoException | null) => {
                this._state = EState.ready;
                if (error) {
                    // tslint:disable-next-line:no-console
                    console.error(`Fail to write logs into file due error: ${error.message}`);
                } else {
                    this.write();
                }
                this._shutdown();
            },
        );
    }

    public shutdown(): Promise<void> {
        return new Promise(resolve => {
            this._shutdownHandler = resolve;
            if (this._buffer.length > 0 && this._state !== EState.ready) {
                this.write(`LogsBlackbox:: Some logs still aren't written. Will wait...`);
            }
            this._shutdown();
        });
    }

    private _shutdown() {
        if (this._shutdownHandler === undefined) {
            return;
        }
        if (this._buffer.length === 0 && this._state === EState.ready) {
            this._state = EState.shutdown;
            this._shutdownHandler();
        }
    }

    private _init() {
        FS.exist(this._homeFolder).then((exist: boolean) => {
            if (!exist) {
                fs.mkdir(this._homeFolder, (err: NodeJS.ErrnoException | null) => {
                    if (err) {
                        // tslint:disable-next-line: no-console
                        console.log(
                            `LogsBlackbox:: Fail to create HOME folder "${this._homeFolder}" due error: ${err.message}`,
                        );
                        this._state = EState.locked;
                    } else {
                        this._state = EState.ready;
                        this.write();
                    }
                });
            } else {
                this._state = EState.ready;
                this.write();
            }
        });
    }
}
