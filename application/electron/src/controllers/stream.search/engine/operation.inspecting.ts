import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { ReadStream } from 'fs';
import Logger from '../../../tools/env.logger';
import guid from '../../../tools/tools.guid';
import { CancelablePromise } from '../../../tools/promise.cancelable';
import ServicePaths from '../../../services/service.paths';
import NullWritableStream from '../../../classes/stream.writable.null';
import Transform from './transform.inspecting';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

type THandler = () => void;

export class OperationInspecting extends EventEmitter {

    private _logger: Logger;
    private _streamFile: string;
    private _searchFile: string;
    private _streamGuid: string;
    private _cleaners: Map<string, THandler> = new Map();
    private _readTo: number = 0;
    private _readFrom: number = 0;
    private _matches: number[] = [];
    private _tasks: Map<string, CancelablePromise<number[], void>> = new Map();

    constructor(streamGuid: string, streamFile: string, searchFile: string) {
        super();
        this._streamGuid = streamGuid;
        this._streamFile = streamFile;
        this._searchFile = searchFile;
        this._logger = new Logger(`Search operation: inspecting (${streamGuid})`);
    }

    public destroy() {
        this.removeAllListeners();
    }

    public perform(regExp: RegExp): CancelablePromise<number[], void> {
        const taskId: string = guid();
        const task: CancelablePromise<number[], void> = new CancelablePromise<number[], void>((resolve, reject, cancel, self) => {
            // Listen cancel for case if it will be canceled while fs.stat
            let canceled: boolean = false;
            self.cancel(() => {
                canceled = true;
            });
            fs.exists(this._streamFile, (exists: boolean) => {
                if (canceled) {
                    return;
                }
                if (!exists) {
                    return resolve([]);
                }
                if (this._readFrom >= this._readTo || isNaN(this._readFrom) || !isFinite(this._readFrom) || isNaN(this._readTo) || !isFinite(this._readTo)) {
                    return reject(new Error(`(inspecting) Cannot perform search because a range isn't correct: from = ${this._readFrom}; to = ${this._readTo}`));
                }
                // Start measuring
                const measurer = this._logger.measure(`inspecting #${guid()}`);
                // Create reader
                const reader: ReadStream = fs.createReadStream(this._searchFile, { encoding: 'utf8', start: this._readFrom, end: this._readTo });
                // Create writer
                const writer: NullWritableStream = new NullWritableStream();
                // Create transform
                const transform = new Transform({});
                // Create process
                const process = spawn(ServicePaths.getRG(), this._getProcArgs(regExp, '-'), {
                    cwd: path.dirname(this._streamFile),
                    stdio: [ 'pipe', 'pipe', 'pipe' ],
                    detached: true,
                });
                // Pipe process with reader: reader -> ripgrep
                reader.pipe(process.stdin);
                // Pipe process with writer: ripgrep -> writer (NULL writer)
                process.stdout.pipe(transform).pipe(writer);
                // Handeling errors
                [process, process.stdin, process.stdout, writer, reader].forEach((smth: NullWritableStream | ChildProcess | Readable | ReadStream | Writable) => {
                    smth.once('error', (error: Error) => {
                        if (!this._cleaners.has(taskId)) {
                            return;
                        }
                        this._logger.error(`Error during inspecting: ${error.message}`);
                        reject(error);
                    });
                });
                // Handeling finishing
                process.once('close', () => {
                    const added: number[] = transform.getLines();
                    this._matches = this._matches.concat(added);
                    resolve(this._matches);
                });
                // Create cleaner
                this._cleaners.set(taskId, () => {
                    // Stop reader
                    reader.removeAllListeners();
                    reader.close();
                    // Stop transform
                    transform.stop();
                    transform.removeAllListeners();
                    // Kill process
                    process.removeAllListeners();
                    process.stdout.removeAllListeners();
                    process.stdout.unpipe();
                    process.stdout.destroy();
                    process.kill();
                    // Remove cleaner
                    this._cleaners.delete(taskId);
                    // Measure spent time
                    measurer();
                });
        });
        }).finally(this._clear.bind(this, taskId));
        this._tasks.set(taskId, task);
        return task;
    }

    public drop() {
        // Cancel all tasks before
        this._tasks.forEach((task: CancelablePromise<number[], void>, id: string) => {
            this._logger.warn(`Dropping search controller, while search operation is still in progress. Current task "${id}" will be dropped`);
            task.break();
        });
        // Drop data
        this._tasks.clear();
        this._cleaners.clear();
        this._readTo = 0;
        this._readFrom = 0;
        this._matches = [];
    }

    public setReadTo(read: number) {
        this._readFrom = this._readTo;
        this._readTo = read;
    }

    private _clear(id: string) {
        const cleaner: THandler | undefined = this._cleaners.get(id);
        this._cleaners.delete(id);
        this._tasks.delete(id);
        if (cleaner !== undefined) {
            cleaner();
        }
    }

    private _isCaseInsensitive(reg: RegExp): boolean {
        return reg.flags.includes('i') ? true : false;
    }

    private _getProcArgs(reg: RegExp, target: string): string[] {
        // TODO: here also should be excluded possible matches with line index and tag in line of source file
        const args = [
            '-N',
            '--text', // https://github.com/BurntSushi/ripgrep/issues/306 this issue is about a case, when not printable symble is in a file
            '--pcre2',
            this._isCaseInsensitive(reg) ? '-i' : '',
            '-e',
            reg.source,
            target,
        ].filter(x => x !== '');
        this._logger.env(`Next regular expresition will be used with ripgrep: ${reg}. Full command: rg ${args.join(' ')}`);
        return args;
    }
}
