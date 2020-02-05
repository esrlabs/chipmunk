import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { ReadStream } from 'fs';
import Logger from '../../../tools/env.logger';
import guid from '../../../tools/tools.guid';
import { CancelablePromise } from '../../../tools/promise.cancelable';
import ServicePaths from '../../../services/service.paths';
import NullWritableStream from '../../../classes/stream.writable.null';
import Transform, { IMatch, CGroupDelimiter } from './transform.charting';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

export { IMatch };

type THandler = () => void;

export class OperationCharting extends EventEmitter {

    private _logger: Logger;
    private _streamFile: string;
    private _streamGuid: string;
    private _cleaners: Map<string, THandler> = new Map();
    private _tasks: Map<string, CancelablePromise<IMatch[], void>> = new Map();

    constructor(streamGuid: string, streamFile: string) {
        super();
        this._streamGuid = streamGuid;
        this._streamFile = streamFile;
        this._logger = new Logger(`Chart operation: inspecting (${streamGuid})`);
    }

    public destroy() {
        this.removeAllListeners();
    }

    public perform(regExp: RegExp, groups: boolean = false): CancelablePromise<IMatch[], void> {
        const taskId: string = guid();
        const task: CancelablePromise<IMatch[], void> = new CancelablePromise<IMatch[], void>((resolve, reject, cancel, self) => {
            let canceled: boolean = false;
            self.cancel(() => {
                this._tasks.delete(taskId);
                canceled = true;
            });
            fs.exists(this._streamFile, (exists: boolean) => {
                if (canceled) {
                    return;
                }
                if (!exists) {
                    return resolve([]);
                }
                // Get count of groups
                const groupsCount: number = this._getGroupsCount(regExp.source);
                groups = !groups ? false : (groupsCount > 0);
                // Start measuring
                const measurer = this._logger.measure(`charting #${guid()}`);
                // Create reader
                const reader: ReadStream = fs.createReadStream(this._streamFile, { encoding: 'utf8' });
                // Create writer
                const writer: NullWritableStream = new NullWritableStream();
                // Create transform
                const transform = new Transform({}, 0, groups);
                // Create process
                const process = spawn(ServicePaths.getRG(), this._getProcArgs(regExp, '-', groups ? groupsCount : 0), {
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
                        this._logger.error(`Error during charting: ${error.message}`);
                        reject(error);
                    });
                });
                // Handeling finishing
                process.once('close', () => {
                    resolve(transform.getMatches());
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
        this._tasks.forEach((task: CancelablePromise<IMatch[], void>, id: string) => {
            this._logger.warn(`Dropping charting controller, while charting operation is still in progress. Current task "${id}" will be dropped`);
            task.break();
        });
        // Drop data
        this._tasks.clear();
        this._cleaners.clear();
    }

    private _clear(id: string) {
        const cleaner: THandler | undefined = this._cleaners.get(id);
        this._cleaners.delete(id);
        this._tasks.delete(id);
        if (cleaner !== undefined) {
            cleaner();
        }
    }

    private _getGroupsCount(regAsStr: string): number {
        const matches: RegExpMatchArray | null = regAsStr.match(/\(.*?\)/gi);
        if (matches === null) {
            return 0;
        }
        return matches.length;
    }

    private _isCaseInsensitive(reg: RegExp): boolean {
        return reg.flags.includes('i') ? true : false;
    }

    private _getProcArgs(reg: RegExp, target: string, groups: number = 0): string[] {
        // TODO: here also should be excluded possible matches with line index and tag in line of source file
        // example of usage: rg -n --text --pcre2 -i -e "ma\w{2,}h" -o ./small.log
        // capturing a groups: rg -n --text --pcre2 -i -e "(ma)\w{2,}h" -o ./small.log -r '$1'
        const args = [
            '-n',
            '--text', // https://github.com/BurntSushi/ripgrep/issues/306 this issue is about a case, when not printable symble is in a file
            '--pcre2',
            this._isCaseInsensitive(reg) ? '-i' : '',
            '-e',
            reg.source,
            '-o',
        ].filter(x => x !== '');
        if (groups > 0) {
            args.push(...[
                '-r',
                (new Array(groups)).fill(0).map((v, i) => {
                    return `$${i + 1}`;
                }).join(CGroupDelimiter),
            ]);
        }
        args.push(target);
        this._logger.env(`Next regular expresition will be used with ripgrep: ${reg.source}. Full command: rg ${args.join(' ')}`);
        return args;
    }
}
