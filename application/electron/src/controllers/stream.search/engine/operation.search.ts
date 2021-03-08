import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { WriteStream, ReadStream } from 'fs';
import Logger from '../../../tools/env.logger';
import { CancelablePromise } from '../../../tools/promise.cancelable';
import ServicePaths from '../../../services/service.paths';
import Transform, { IMapItem, IMapChunkEvent, IOffset } from './transform.map';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

export { IMapChunkEvent };

type THandler = () => void;

export class OperationSearch extends EventEmitter {

    public static Events = {
        onMapUpdated: 'onMapUpdated',
    };

    private _logger: Logger;
    private _streamFile: string;
    private _searchFile: string;
    private _streamGuid: string;
    private _cleaner: THandler | undefined;
    private _offset: IOffset = { bytes: 0, rows: 0 };
    private _read: number = 0;
    private _task: CancelablePromise<IMapItem[], void> | undefined;

    constructor(streamGuid: string, streamFile: string, searchFile: string) {
        super();
        this._streamGuid = streamGuid;
        this._streamFile = streamFile;
        this._searchFile = searchFile;
        this._logger = new Logger(`Search: search (${streamGuid})`);
        this._clear = this._clear.bind(this);
    }

    public destroy() {
        this.removeAllListeners();
    }

    public perform(
        regExp: RegExp | RegExp[],
        guid: string,
    ): CancelablePromise<IMapItem[], void> | Error {
        if (this._cleaner !== undefined) {
            this._logger.warn(`Attempt to start search, while previous isn't finished`);
            return new Error(`(search) Fail to start search, because previous process isn't finished.`);
        }
        this._task = new CancelablePromise<IMapItem[], void>((resolve, reject, cancel, self) => {
            // Listen cancel for case if it will be canceled while fs.stat
            let canceled: boolean = false;
            self.cancel(() => {
                canceled = true;
                this._clear();
            });
            fs.stat(this._streamFile, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                if (canceled) {
                    return;
                }
                if (err) {
                    return reject(err);
                }
                // Remember file size
                this._read = stats.size;
                // Start measuring
                const measurer = this._logger.measure(`search #${guid}`);
                // Create transform
                const transform = new Transform({}, this._streamGuid);
                // Listen map event
                transform.on(Transform.Events.found, (event: IMapChunkEvent) => {
                    this.emit(OperationSearch.Events.onMapUpdated, event);
                });
                // Create writer
                const writer: WriteStream = fs.createWriteStream(this._searchFile);
                // Create process
                const process: ChildProcess = spawn(ServicePaths.getRG(), this._getProcArgs(regExp, this._streamFile), {
                    cwd: path.dirname(this._streamFile),
                    stdio: [ 'pipe', 'pipe', 'pipe' ],
                });
                if (process.stdin === null || process.stdout === null) {
                    return reject(new Error(`No stdin / stdout`));
                }
                // Handeling errors
                [process, process.stdin, process.stdout, writer].forEach((smth: WriteStream | ChildProcess | ReadStream | Readable | Writable) => {
                    smth.once('error', (error: Error) => {
                        if (this._cleaner === undefined) {
                            return;
                        }
                        this._logger.error(`Error during search: ${error.message}`);
                        reject(error);
                    });
                });
                // Handeling finishing
                process.once('close', () => {
                    if (!writer.writableFinished) {
                        writer.once('finish', () => {
                            this._offset = transform.getOffsets();
                            resolve(transform.getMap());
                        });
                    } else {
                        this._offset = transform.getOffsets();
                        resolve(transform.getMap());
                    }
                });
                // Start reading / writing output of ripgrep
                process.stdout.pipe(transform).pipe(writer);
                // Create cleaner
                this._cleaner = () => {
                    // Kill process
                    process.removeAllListeners();
                    process.stdin?.removeAllListeners();
                    process.stdin?.end();
                    process.stdin?.destroy();
                    process.stdout?.removeAllListeners();
                    process.stdout?.unpipe();
                    process.stdout?.destroy();
                    process.kill();
                    // Attention. Using of writer.destroy() here will give "Uncatchable error: Cannot call write after a stream was destroyed"
                    // it doesn't block any how main process, but not okay to have it for sure
                    // Stop writer
                    writer.removeAllListeners();
                    writer.close();
                    // Stop transform
                    transform.lock();
                    transform.removeAllListeners();
                    // Measure spent time
                    measurer();
                    // Drop task
                    this._task = undefined;
                    // Drop cleaner
                    this._cleaner = undefined;
                    this._logger.debug(`RG process is finished/killed (task ID: ${guid})`);
                };
            });
        }).finally(this._clear);
        return this._task;
    }

    public getOffset(): IOffset {
        return Object.assign({}, this._offset);
    }

    public getReadBytesAmount(): number {
        return this._read;
    }

    public isBusy(): boolean {
        return this._cleaner !== undefined;
    }

    public drop() {
        if (this._task !== undefined) {
            this._logger.warn(`Dropping search controller, while search operation is still in progress. Current task will be dropped`);
            this._task.break();
        }
        this._read = 0;
        this._offset = { bytes: 0, rows: 0 };
    }

    private _clear() {
        if (this._cleaner !== undefined) {
            this._cleaner();
        }
    }

    private _constractRegExpStr(regulars: RegExp | RegExp[]): string {
        if (!(regulars instanceof Array)) {
            regulars = [regulars];
        }
        const i: boolean = this._isCaseInsensitive(regulars);
        const regs: string[] = regulars.map((regular: RegExp) => {
            return i ? `((?i)${regular.source})` : regular.source;
        });
        return `(${regs.join('|')}).*\\x{0003}\\d*\\x{0003}`;
    }

    private _isCaseInsensitive(regulars: RegExp | RegExp[]): boolean {
        if (regulars instanceof Array) {
            return regulars.length > 0 ? (regulars[0].flags.includes('i') ? true : false) : true;
        } else {
            return regulars.flags.includes('i') ? true : false;
        }
    }

    private _getProcArgs(regulars: RegExp | RegExp[], target: string): string[] {
        const expression: string = this._constractRegExpStr(regulars);
        const args = [
            '-N',
            '--text', // https://github.com/BurntSushi/ripgrep/issues/306 this issue is about a case, when not printable symble is in a file
            '--pcre2',
            '-e',
            expression,
            target,
        ].filter(x => x !== '');
        this._logger.env(`Next regular expresition will be used with ripgrep: ${expression}. Full command: rg ${args.join(' ')}`);
        return args;
    }

}
