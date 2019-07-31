import { rgPath } from 'vscode-ripgrep';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import Logger from '../tools/env.logger';

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

export class RGSearchWrapper {

    private _logger: Logger;
    private _targetFile: string;
    private _resultsFile: string;
    private _cmd: string = rgPath.replace(/\bnode_modules\.asar\b/, 'node_modules.asar.unpacked');
    private _process: ChildProcess | undefined;
    private _last: string | undefined;

    constructor(targetFile: string, resultsFile: string) {
        this._targetFile = targetFile;
        this._resultsFile = resultsFile;
        this._logger = new Logger(`RGSearchWrapper (${path.basename(targetFile)})`);
    }

    public search(regExp: RegExp | RegExp[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._process !== undefined) {
                return new Error(this._logger.warn(`Cannot start new search because previous isn't finished yet.`));
            }
            if (!(regExp instanceof Array)) {
                regExp = [regExp];
            }
            const regs: string[] = [];
            const numeric: string[] = [];
            regExp.forEach((regexp: RegExp, i: number) => {
                regs.push(`(${regexp.source})`);
                if (regexp.source.replace(/\d/gi, '') === '') {
                    numeric.push(`(${regexp.source})`);
                }
            });
            const reg = `(?!\\d*${numeric.join('|')}\\d*\u0002$)(${regs.join('|')})`;
            const args: string[] = [
                '-N',
                '--text', // https://github.com/BurntSushi/ripgrep/issues/306 this issue is about a case, when not printable symble is in a file
                '--pcre2',
                '-i',
                '-e',
                reg,
                this._targetFile,
            ];
            const writer: fs.WriteStream = fs.createWriteStream(this._resultsFile);
            this._process = spawn(this._cmd, args, {
                cwd: path.dirname(this._targetFile),
            });
            this._process.stdout.pipe(writer);
            this._process.once('close', () => {
                this._process = undefined;
                this._last = reg;
                writer.close();
                resolve();
            });
            this._process.once('error', (error: Error) => {
                this._process = undefined;
                this._last = undefined;
                writer.close();
                this._logger.error(`Error during calling rg: ${error.message}`);
                reject(error);
            });
        });
    }

    public append(from: number, to: number): Promise<void> {
        return new Promise((resolve, reject) => {
            setImmediate(() => {
                if (this._process !== undefined) {
                    return new Error(this._logger.warn(`Cannot append search because previous process isn't finished yet.`));
                }
                if (this._last === undefined) {
                    return new Error(this._logger.warn(`Cannot append search because there are no primary search yet.`));
                }
                const reader: fs.ReadStream = fs.createReadStream(this._targetFile, { encoding: 'utf8', start: from, end: to});
                const args: string[] = [
                    '-N',
                    '--text', // https://github.com/BurntSushi/ripgrep/issues/306 this issue is about a case, when not printable symble is in a file
                    '-i',
                    '-e',
                    this._last,
                    '-',
                ];
                const writer: fs.WriteStream = fs.createWriteStream(this._resultsFile, { flags: 'a', mode: 666 });
                this._process = spawn(this._cmd, args, {
                    cwd: path.dirname(this._targetFile),
                    stdio: [ 'pipe', 'pipe', 'pipe' ],
                });
                reader.pipe(this._process.stdin);
                this._process.stdout.pipe(writer);
                this._process.once('close', () => {
                    this._process = undefined;
                    writer.close();
                    reader.close();
                    resolve();
                });
                this._process.once('error', (error: Error) => {
                    this._process = undefined;
                    this._last = undefined;
                    writer.close();
                    reader.close();
                    this._logger.error(`Error during calling rg: ${error.message}`);
                    reject(error);
                });
            });
        });
    }

    public isBusy(): boolean {
        return this._process !== undefined;
    }

}
