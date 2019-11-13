import * as Stream from 'stream';
import Logger from '../../../tools/env.logger';

export interface IMatch {
    row: number;
    value: string[] | undefined;
}

export const CGroupDelimiter = '\u0002';
/*
Example of matches:

LINENUMBER:MATCH

120098:MainEventTh
120258:MATCH
124081:MaxCh
124081:maxImageHeigh
124081:maxSubjectLength
124081:maxImageWidth
125904:MaxCh
125904:maxImageHeigh
*/
export default class Transform extends Stream.Transform {

    private _logger: Logger;
    private _rest: string = '';
    private _matches: IMatch[] = [];
    private _groups: boolean = false;
    private _stopped: boolean = false;

    constructor(options: Stream.TransformOptions, groups: boolean = false) {
        super(options);
        this._logger = new Logger(`Transform.Charting`);
        this._groups = groups;
    }

    public getMatches(): IMatch[] {
        return this._matches;
    }

    public _transform(chunk: Buffer | string, encoding: string, callback: Stream.TransformCallback | undefined): void {
        // Convert to utf8 and insert rest from previos
        let output: string = '';
        if (typeof chunk === 'string') {
            output = this._rest + chunk;
        } else {
            output = this._rest + chunk.toString('utf8');
        }
        // Get rest from the end
        const rest = this._getRest(output);
        this._rest = rest.rest;
        output = rest.cleared;
        // Get lines
        const lines: string[] = output.split(/[\n\r]/gi);
        lines.forEach((line: string) => {
            const parts = line.split(':');
            if (parts.length < 2) {
                return;
            }
            const num: number = parseInt(parts[0], 10);
            if (isNaN(num) || !isFinite(num)) {
                this._logger.warn(`Fail to detect line number for ${line}`);
                return;
            }
            const match: IMatch = {
                row: num,
                value: this._groups ? parts[1].split(CGroupDelimiter) : undefined,
            };
            this._matches.push(match);
        });
        // Check state
        if (this._stopped) {
            return;
        }
        // Call callback
        if (callback !== undefined) {
            callback(undefined, output);
        }
    }

    public stop() {
        this._stopped = true;
    }

    private _getRest(str: string): { rest: string, cleared: string } {
        const last = str.length - 1;
        for (let i = last; i >= 0; i -= 1) {
            if (str[i] === '\n' && i > 0) {
                return {
                    rest: str.substr(i + 1, last),
                    cleared: str.substr(0, i + 1),
                };
            }
        }
        return { rest: '', cleared: str };
    }

}
