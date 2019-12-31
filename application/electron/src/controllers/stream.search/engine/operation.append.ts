import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { WriteStream, ReadStream } from 'fs';
import Logger from '../../../tools/env.logger';
import guid from '../../../tools/tools.guid';
import { CancelablePromise } from '../../../tools/promise.cancelable';
import ServicePaths from '../../../services/service.paths';
import Transform, { IMapItem, IMapChunkEvent } from './transform.map';
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
    private _last: { from: number, to: number } | undefined;

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
        range: { from: number, to: number },
        mapOffset: { bytes: number, rows: number },
    ): CancelablePromise<IMapItem[], void> | Error {
        if (this._cleaner !== undefined) {
            this._logger.warn(`Attempt to start search, while previous isn't finished`);
            return new Error(`(search) Fail to start search, because previous process isn't finished.`);
        }
        if (this._last !== undefined) {
            if (this._last.to !== range.from - 1) {
                this._logger.error(`Last ranage was finished with ${this._last.to} bytes, but new range is started from ${range.from} byte.`);
                return new Error(`Wrong range for append operation`);
            }
        }
        this._last = Object.assign(range);
        return new CancelablePromise<IMapItem[], void>((resolve, reject, cancel, self) => {
            const id: string = guid();
            this._logger.measure(`Appending (#${id}): bytes: ${range.from} - ${range.to}; offset: ${mapOffset.bytes} bytes; ${mapOffset.rows} rows.`);
            // Start measuring
            const measurer = this._logger.measure(`appending search #${id}`);
            // Create transformer to build map
            const transform: Transform = new Transform({}, this._streamGuid, mapOffset);
            transform.on(Transform.Events.found, (event: IMapChunkEvent) => {
                this.emit(OperationAppend.Events.onMapUpdated, event);
            });
            // Create reader
            const reader: ReadStream = fs.createReadStream(this._streamFile, { encoding: 'utf8', start: range.from, end: range.to });
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
                transform.stop();
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

    public dropCursorPosition() {
        this._last = undefined;
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
