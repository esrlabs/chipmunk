import * as Stream from 'stream';
import Logger from '../tools/env.logger';
import * as moment from 'moment-timezone';

export interface IResults {
    read: number;
    found: number;
    errors: string[];
    first: Date | undefined;
    last: Date | undefined;
}

export default class Transform extends Stream.Transform {

    private _logger: Logger;
    private _file: string;
    private _timestamp: RegExp;
    private _offset: number;
    private _format: string;
    private _readed: number = 0;
    private _errors: string[] = [];
    private _times: number[] = [];
    private _zone: string = '';
    private _rest: string = '';

    constructor(options: Stream.TransformOptions, file: string, timestamp: RegExp, offset: number, format: string) {
        super(options);
        this._file = file;
        this._offset = offset;
        this._format = format;
        this._timestamp = timestamp;
        this._logger = new Logger(`ControllerMergeFilesTestTransform: ${this._file}`);
    }

    public getResults(): IResults {
        return {
            read: this._readed,
            errors: this._errors,
            found: this._times.length,
            first: this._times.length !== 0 ? (new Date(this._times[0])) : undefined,
            last: this._times.length !== 0 ? (new Date(this._times[this._times.length - 1])) : undefined,
        };
    }

    public _transform(chunk: Buffer | string, encoding: string, callback: Stream.TransformCallback | undefined): void {
        // Convert to utf8 and insert rest from previos
        let output: string = '';
        if (typeof chunk === 'string') {
            output = `${this._rest}${chunk}`;
        } else {
            output = `${this._rest}${chunk.toString('utf8')}`;
        }
        // Remove double carret
        output = output.replace(/[\r?\n|\r]/gi, '\n').replace(/\n{2,}/g, '\n');
        // Get rest from the end
        const rest = this._getRest(output);
        this._rest = rest.rest;
        output = rest.cleared;
        // Convert to rows
        const rows: string[] = output.split(/[\n\r]/gi);
        // Try to find timestapm
        rows.forEach((row: string) => {
            const match: RegExpMatchArray | null = row.match(this._timestamp);
            this._readed += 1;
            if (match === null) {
                return;
            }
            if (match.length !== 1) {
                this._errors.push(`Found a few matches in row: ${row}. Matches: ${match.join(', ')}. Expected only 1 match.`);
                return;
            }
            const timestampStr: string = match[0];
            let datetime: Date;
            if (timestampStr.replace(/\d*\.?\d*/i, '') === '') {
                // timestamp looks like unix time
                datetime = new Date(parseFloat(timestampStr));
            } else {
                // Try to convert to date
                datetime = new Date(timestampStr);
            }
            // Check results
            if (!this._isDateValid(datetime)) {
                return { unixtime: -1, str: row };
            }
            // Apply offset if needed
            if (this._offset !== 0) {
                datetime = new Date(datetime.getTime() + this._offset);
            }
            this._times.push(datetime.getTime());
        });
        if (callback === undefined) {
            return;
        }
        callback(undefined, output);
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

    private _isDateValid(date: Date) {
        return date instanceof Date && !isNaN(date.getTime());
    }

}
