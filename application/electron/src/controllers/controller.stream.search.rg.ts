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
            let reg: string = '';
            regExp.forEach((regexp: RegExp, i: number) => {
                reg += `${i !== 0 ? '|' : ''}(${regexp.source})`;
            });
            const args: string[] = [
                '-N',
                '--text', // https://github.com/BurntSushi/ripgrep/issues/306 this issue is about a case, when not printable symble is in a file
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
                writer.close();
                resolve();
            });
            this._process.once('error', (error: Error) => {
                this._process = undefined;
                this._logger.error(`Error during calling rg: ${error.message}`);
                reject(error);
            });
        });
    }

}
