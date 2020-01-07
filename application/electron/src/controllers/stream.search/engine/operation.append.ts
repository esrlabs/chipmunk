import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { WriteStream, ReadStream } from 'fs';
import Logger from '../../../tools/env.logger';
import guid from '../../../tools/tools.guid';
import { CancelablePromise } from '../../../tools/promise.cancelable';
import ServicePaths from '../../../services/service.paths';
import Transform, { IMapItem, IMapChunkEvent, IOffset } from './transform.map';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

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
    ): CancelablePromise<IMapItem[], void> | Error {
        if (this._cleaner !== undefined) {
            this._logger.warn(`Attempt to start search, while previous isn't finished`);
            return new Error(`(search) Fail to start search, because previous process isn't finished.`);
        }
        return new CancelablePromise<IMapItem[], void>((resolve, reject, cancel, self) => {
            const id: string = guid();
            // this._logger.measure(`Appending (#${id}): bytes: ${range.from} - ${range.to}; offset: ${mapOffset.bytes} bytes; ${mapOffset.rows} rows.`);
            // Start measuring
            const measurer = this._logger.measure(`appending search #${id}`);
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
            [process, process.stdout, writer, reader].forEach((smth: WriteStream | ChildProcess | ReadStream | Readable) => {
                smth.once('error', (error: Error) => {
                    this._logger.error(`Error during search: ${error.message}`);
                    if (this._cleaner === undefined) {
                        return;
                    }
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
                // Attention. Using of writer.destroy() here will give "Uncatchable error: Cannot call write after a stream was destroyed"
                // it doesn't block any how main process, but not okay to have it for sure
                // Stop reader
                reader.removeAllListeners();
                reader.close();
                // Stop writer
                writer.removeAllListeners();
                writer.close();
                // Stop transform
                transform.lock();
                transform.removeAllListeners();
                // Kill process
                process.removeAllListeners();
                process.stdout.removeAllListeners();
                process.stdout.unpipe();
                process.stdout.destroy();
                process.kill();
                // Measure spent time
                measurer();
            };
        }).finally(this._clear.bind(this));
    }

    public setOffset(offset: IOffset) {
        this._offset = offset;
    }

    public setReadFrom(read: number) {
        this._readFrom = read;
    }

    public drop() {
        // TODO: what if task is in progress?
        if (this._cleaner !== undefined) {
            this._logger.error(`Dropping append controller, while append operation is still in progress.`);
        }
        this._readFrom = 0;
        this._offset = { bytes: 0, rows: 0 };
    }

    private _clear() {
        if (this._cleaner === undefined) {
            return;
        }
        this._cleaner();
        this._cleaner = undefined;
    }

    private _constractRegExpStr(regulars: RegExp | RegExp[]): string {
        if (!(regulars instanceof Array)) {
            regulars = [regulars];
        }
        const regs: string[] = regulars.map((regular: RegExp) => {
            return regular.source;
        });
        return `(${regs.join('|')}).*\\x{0003}\\d*\\x{0003}`;
    }

    private _getProcArgs(regulars: RegExp | RegExp[], target: string): string[] {
        const expression: string = this._constractRegExpStr(regulars);
        const args = [
            '-N',
            '--text', // https://github.com/BurntSushi/ripgrep/issues/306 this issue is about a case, when not printable symble is in a file
            '--pcre2',
            '-i',
            '-e',
            expression,
            target,
        ];
        this._logger.env(`Next regular expresition will be used with ripgrep: ${expression}. Full command: rg ${args.join(' ')}`);
        return args;
    }

}
