import { spawn, ChildProcess } from 'child_process';
import { ReadStream } from 'fs';
import { CancelablePromise } from "indexer-neon";
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { IRangeDefinition } from './transform.results';
import { CommonInterfaces } from '../../../interfaces/interface.common';

import Logger from '../../../tools/env.logger';
import Transform from './transform.results';
import ServicePaths from '../../../services/service.paths';
import NullWritableStream from '../../../classes/stream.writable.null';

import * as path from 'path';
import * as fs from 'fs';

export { IRangeDefinition };

export interface IRangeEvent {
    guid: string;
    range: CommonInterfaces.TimeRanges.IRange;
}

export class OperationSearch extends EventEmitter {

    public static Events = {
        range: 'range',
    };

    private _logger: Logger;
    private _streamFile: string;
    private _streamGuid: string;
    private _tasks: Map<string, CancelablePromise<CommonInterfaces.TimeRanges.IRange[], void>> = new Map();

    constructor(streamGuid: string,
                streamFile: string) {
        super();
        this._streamGuid = streamGuid;
        this._streamFile = streamFile;
        this._logger = new Logger(`Time ranges: search (${streamGuid})`);
    }

    public destroy(): Promise<void> {
        this.removeAllListeners();
        return this.drop();
    }

    public perform(
        guid: string,
        format: string,
        definition: IRangeDefinition,
    ): CancelablePromise<CommonInterfaces.TimeRanges.IRange[], void> {
        // tslint:disable-next-line: no-empty
        let cleaner: () => void;
        const task = new CancelablePromise<CommonInterfaces.TimeRanges.IRange[], void>((resolve, reject, cancel, ref, self) => {
            // Listen cancel for case if it will be canceled while fs.stat
            let canceled: boolean = false;
            self.canceled(() => {
                canceled = true;
            });
            fs.stat(this._streamFile, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                if (canceled) {
                    return;
                }
                if (err) {
                    return reject(err);
                }
                // Start measuring
                const measurer = this._logger.measure(`search #${guid}`);
                // Create transform
                const transform = new Transform({}, this._streamGuid, format, definition);
                // Listen map event
                transform.on(Transform.Events.range, (range: CommonInterfaces.TimeRanges.IRange) => {
                    this.emit(OperationSearch.Events.range, {
                        guid: guid,
                        range: range,
                    });
                });
                // Create writer
                const writer: NullWritableStream = new NullWritableStream();
                // Create process
                const process: ChildProcess = spawn(ServicePaths.getRG(), this._getProcArgs(definition.points, this._streamFile), {
                    cwd: path.dirname(this._streamFile),
                    stdio: [ 'pipe', 'pipe', 'pipe' ],
                });
                // Handeling errors
                [process, process.stdin, process.stdout, writer].forEach((smth: NullWritableStream | ChildProcess | ReadStream | Readable) => {
                    smth.once('error', (error: Error) => {
                        if (cleaner === undefined) {
                            return;
                        }
                        this._logger.error(`Error during search: ${error.message}`);
                        reject(error);
                    });
                });
                // Handeling finishing
                process.once('close', () => {
                    transform.result((ranges: CommonInterfaces.TimeRanges.IRange[]) => {
                        resolve(ranges);
                    });
                });
                // Start reading / writing output of ripgrep
                process.stdout.pipe(transform).pipe(writer);
                // Create cleaner
                cleaner = () => {
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
                    // Stop writer
                    writer.removeAllListeners();
                    // Stop transform
                    transform.lock();
                    transform.removeAllListeners();
                    // Measure spent time
                    measurer();
                    this._tasks.delete(guid);
                };
            });
        }).finally(() => {
            if (cleaner === undefined) {
                this._tasks.delete(guid);
                return;
            }
            cleaner();
        });
        this._tasks.set(guid, task);
        return task;
    }

    public drop(guid?: string): Promise<void> {
        return new Promise((resolve) => {
            if (guid !== undefined) {
                const task = this._tasks.get(guid);
                if (task === undefined) {
                    resolve();
                } else {
                    task.abort().finally(() => {
                        resolve();
                    });
                }
                return;
            }
            if (this._tasks.size > 0) {
                this._tasks.forEach((task: CancelablePromise<CommonInterfaces.TimeRanges.IRange[], void>) => {
                    task.abort().finally(() => {
                        if (this._tasks.size === 0) {
                            resolve();
                        }
                    });
                });
            } else {
                resolve();
            }
        });
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
