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

export class OperationAppend extends EventEmitter {

    public static Events = {
        onMapUpdated: 'onMapUpdated',
    };

    private _logger: Logger;
    private _streamFile: string;
    private _searchFile: string;
    private _streamGuid: string;
    private _cleaner: THandler | undefined;
    private _readFrom: number = 0;
    private _offset: IOffset = { bytes: 0, rows: 0 };
    private _task: CancelablePromise<IMapItem[], void> | undefined;

    constructor(streamGuid: string, streamFile: string, searchFile: string) {
        super();
        this._streamGuid = streamGuid;
        this._streamFile = streamFile;
        this._searchFile = searchFile;
        this._logger = new Logger(`Search operation: append (${streamGuid})`);
        this._clear = this._clear.bind(this);
    }

    public destroy() {
        this.removeAllListeners();
    }

    public perform(
        regExp: RegExp | RegExp[],
        readTo: number,
        guid: string,
    ): CancelablePromise<IMapItem[], void> | Error {
        if (this._readFrom >= readTo || isNaN(this._readFrom) || !isFinite(this._readFrom) || isNaN(readTo) || !isFinite(readTo)) {
            return new Error(`(append) Cannot perform search because a range isn't correct: from = ${this._readFrom}; to = ${readTo}`);
        }
        if (this._cleaner !== undefined) {
            this._logger.warn(`Attempt to start search, while previous isn't finished`);
            return new Error(`(append) Fail to start search, because previous process isn't finished.`);
        }
        this._task = new CancelablePromise<IMapItem[], void>((resolve, reject, cancel, self) => {
            // this._logger.measure(`Appending (#${id}): bytes: ${range.from} - ${range.to}; offset: ${mapOffset.bytes} bytes; ${mapOffset.rows} rows.`);
            // Start measuring
            const measurer = this._logger.measure(`appending search #${guid}`);
            // Unblock transform
            const transform: Transform = new Transform({}, this._streamGuid, this._offset);
            // Listen map event
            transform.on(Transform.Events.found, (event: IMapChunkEvent) => {
                this.emit(OperationAppend.Events.onMapUpdated, event);
            });
            // Create reader
            const reader: ReadStream = fs.createReadStream(this._streamFile, { encoding: 'utf8', start: this._readFrom, end: readTo });
            // Create writer
            const writer: WriteStream = fs.createWriteStream(this._searchFile, { flags: 'a' });
            // Create process
            const process: ChildProcess = spawn(ServicePaths.getRG(), this._getProcArgs(regExp, '-'), {
                cwd: path.dirname(this._streamFile),
                stdio: [ 'pipe', 'pipe', 'pipe' ],
            });
            // Pipe process with reader: reader -> ripgrep
            reader.pipe(process.stdin);
            // Pipe process with writer: ripgrep -> writer
            process.stdout.pipe(transform).pipe(writer);
            // Handeling errors
            [process, process.stdin, process.stdout, writer, reader, transform].forEach((smth: WriteStream | ChildProcess | ReadStream | Readable | Writable, i: number) => {
                smth.once('error', (error: Error) => {
                    if (this._cleaner === undefined) {
                        return;
                    }
                    this._logger.error(`Error during append (task: ${guid}): ${error.message}`);
                    reject(error);
                });
            });
            // Handeling fiinishing
            process.once('close', () => {
                this.setReadFrom(readTo + 1);
                resolve(transform.getMap());
            });
            // Create cleaner
            this._cleaner = () => {
                // Kill process
                process.removeAllListeners();
                process.stdin.removeAllListeners();
                process.stdin.end();
                process.stdin.destroy();
                process.stdout.removeAllListeners();
                process.stdout.unpipe();
                process.stdout.destroy();
                process.kill();
                // Attention. Using of writer.destroy() here will give "Uncatchable error: Cannot call write after a stream was destroyed"
                // it doesn't block any how main process, but not okay to have it for sure
                // Stop reader
                reader.removeAllListeners();
                reader.close();
                reader.destroy();
                // Stop writer
                writer.removeAllListeners();
                writer.close();
                // Stop transform
                transform.lock();
                transform.removeAllListeners();
                // Measure spent time
                measurer();
            };
        }).finally(this._clear.bind(this));
        return this._task;
    }

    public setOffset(offset: IOffset) {
        this._offset = offset;
    }

    public setReadFrom(read: number) {
        this._readFrom = read;
    }

    public drop() {
        if (this._task !== undefined) {
            this._logger.warn(`Dropping search controller, while search operation is still in progress. Current task will be dropped`);
            this._task.break();
        }
        this._readFrom = 0;
        this._offset = { bytes: 0, rows: 0 };
    }

    private _clear() {
        if (this._cleaner !== undefined) {
            this._cleaner();
        }
        // Drop task
        this._task = undefined;
        // Drop cleaner
        this._cleaner = undefined;
    }

    private _isCaseInsensitive(regulars: RegExp | RegExp[]): boolean {
        if (regulars instanceof Array) {
            return regulars.length > 0 ? (regulars[0].flags.includes('i') ? true : false) : true;
        } else {
            return regulars.flags.includes('i') ? true : false;
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
