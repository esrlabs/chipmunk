import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import Logger from '../tools/env.logger';
import { CancelablePromise } from '../tools/promise.cancelable';
import ServicePaths from '../services/service.paths';

export interface IResults {
    regs: { [regIndex: number]: number[] }; // Indexes with matchs, like { 1: [2,3,4] } where 1 - index of reg; [2,3,4] - numbers of rows with match
    matches: number[];                      // All numbers of rows with match
    found: number;                          // Total count of matches
    str: string;                            // Rows with matches
    rows: number;                           // Count of rows with match
}

export interface IMatch {
    text: string;
    index: number;
}

export interface IRegDescription {
    reg: RegExp;
    groups: number;
}

type TMeasurer = () => void;

export class ControllerStreamSearchEngine {

    private _logger: Logger;
    private _streamFile: string;
    private _searchFile: string;
    private _cmd: string = ServicePaths.getRG();
    private _process: ChildProcess | undefined;
    private _writer: fs.WriteStream | undefined;
    private _reader: fs.ReadStream | undefined;
    private _last: string | undefined;
    private _promise: CancelablePromise<boolean, void> | undefined;
    private _measurer: TMeasurer | undefined;

    constructor(streamFile: string, searchFile: string) {
        this._streamFile = streamFile;
        this._searchFile = searchFile;
        this._logger = new Logger(`ControllerStreamSearchEngine (${path.basename(searchFile)})`);
    }

    public search(regExp: RegExp | RegExp[], requestId: string): CancelablePromise<boolean, void> | Error {
        if (this._promise !== undefined) {
            const msg: string = `(search) Fail to start search, because previous process isn't finished.`;
            this._logger.warn(msg);
            return new Error(msg);
        }
        this._promise = new CancelablePromise((resolve, reject) => {
            if (!(regExp instanceof Array)) {
                regExp = [regExp];
            }
            this._setMeasurer();
            const regs: string[] = [];
            const numeric: string[] = [];
            regExp.forEach((regexp: RegExp, i: number) => {
                regs.push(`(${regexp.source})`);
                if (regexp.source.replace(/\d/gi, '') === '' || regexp.source.indexOf('\d') !== -1) {
                    numeric.push(`(${regexp.source})`);
                }
            });
            const reg = `(?!\\d*(${numeric.join('|')})\\d*\u0002$)(${regs.join('|')})`;
            this._writer = fs.createWriteStream(this._searchFile);
            this._process = spawn(this._cmd, this._getProcArgs(reg, this._streamFile), {
                cwd: path.dirname(this._streamFile),
                stdio: [ 'pipe', 'pipe', 'pipe' ],
            });
            this._process.stdout.pipe(this._writer);
            this._process.once('close', () => {
                this._setLast(reg);
                resolve(true);
            });
            this._process.once('error', (error: Error) => {
                this._logger.error(`Error during executing ripgrep: ${error.message}`);
                this._setLast(undefined);
                reject(error);
            });
            this._process.stdout.on('error', (error: Error) => {
                this._logger.error(`Error during executing ripgrep: ${error.message}`);
            });
            this._writer.on('error', (error: Error) => {
                this._logger.error(`(w)Error during executing ripgrep: ${error.message}`);
            });
        });
        this._promise.cancel(this._clear.bind(this));
        this._promise.finally(this._clear.bind(this));
        return this._promise;
    }

    public append(from: number, to: number): CancelablePromise<boolean, void> | Error {
        if (this._promise !== undefined) {
            const msg: string = `(search) Fail to start search, because previous process isn't finished.`;
            this._logger.warn(msg);
            return new Error(msg);
        }
        if (this._last === undefined) {
            return new Error(this._logger.warn(`Cannot append search because there are no primary search yet.`));
        }
        this._promise = new CancelablePromise((resolve, reject) => {
            setImmediate(() => {
                if (this._last === undefined) {
                    return reject(new Error(this._logger.warn(`Cannot append search because there are no primary search yet.`)));
                }
                this._setMeasurer();
                this._reader = fs.createReadStream(this._streamFile, { encoding: 'utf8', start: from, end: to});
                this._writer = fs.createWriteStream(this._searchFile, { flags: 'a', mode: 666 });
                this._process = spawn(this._cmd, this._getProcArgs(this._last, '-'), {
                    cwd: path.dirname(this._streamFile),
                    stdio: [ 'pipe', 'pipe', 'pipe' ],
                });
                this._reader.pipe(this._process.stdin);
                this._process.stdout.pipe(this._writer);
                this._process.once('close', () => {
                    resolve(true);
                });
                this._process.once('error', (error: Error) => {
                    this._logger.error(`Error during executing ripgrep: ${error.message}`);
                    reject(error);
                });
            });
        });
        this._promise.cancel(this._clear.bind(this));
        this._promise.finally(this._clear.bind(this));
        return this._promise;
    }

    public cancel(): boolean {
        if (this._promise === undefined) {
            return false;
        }
        this._promise.break();
        return true;
    }

    public isBusy(): boolean {
        return this._promise !== undefined;
    }

    private _clear() {
        if (this._reader !== undefined) {
            this._reader.unpipe();
            this._reader.removeAllListeners();
            this._reader.destroy();
        }
        if (this._writer !== undefined) {
            this._writer.removeAllListeners();
            // Attention. Using of writer.destroy() here will give "Uncatchable error: Cannot call write after a stream was destroyed"
            // it doesn't block any how main process, but not okay to have it for sure
            this._writer.close();
        }
        if (this._process !== undefined) {
            this._process.stdout.unpipe();
            this._process.stdout.destroy();
            this._process.kill();
        }
        if (this._measurer !== undefined) {
            this._measurer();
        }
        this._process = undefined;
        this._promise = undefined;
        this._measurer = undefined;
        this._reader = undefined;
        this._writer = undefined;
    }

    private _setMeasurer() {
        this._measurer = this._logger.measure(`search`);
    }

    private _setLast(last: string | undefined) {
        this._last = last;
    }

    private _getProcArgs(reg: string, target: string): string[] {
        return [
            '-N',
            '--text', // https://github.com/BurntSushi/ripgrep/issues/306 this issue is about a case, when not printable symble is in a file
            '--pcre2',
            '-i',
            '-e',
            reg,
            target,
        ];
    }
}
