import Logger from '../tools/env.logger';
import * as moment from 'moment-timezone';
import { AFileParser, IFileParserFunc } from './files.parsers/index';
import ServiceFileParsers from '../services/service.file.parsers';
import { CRegCarrets } from '../consts/regs';

export interface IRow {
    str: string;
    unixtime: number;
}

export default class Holder {

    private _logger: Logger;
    private _file: string;
    private _reg: RegExp;
    private _format: string;
    private _zone: string;
    private _offset: number;
    private _rest: string = '';
    private _parser: string = '';
    private _parserFunc: IFileParserFunc;
    private _rows: IRow[] = [];

    constructor(file: string, reg: RegExp, format: string, offset: number, zone: string, parser: string) {
        this._file = file;
        this._format = format;
        this._reg = reg;
        this._offset = offset;
        this._zone = zone;
        this._parser = parser;
        this._logger = new Logger(`ControllerMergeFilesWriterHolder: ${this._file}`);
        const parserFunc: IFileParserFunc | undefined = this._getParserFunc(parser);
        if (parserFunc === undefined) {
            throw new Error(`Cannot find parser function for parser "${parser}".`);
        }
        this._parserFunc = parserFunc;
    }

    public destroy() {
        this._parserFunc.close();
        this._rows = [];
    }

    public add(income: Buffer): Promise<void> {
        return new Promise((resolve, reject) => {
            this._parserFunc.parse(income).then((chunk: Buffer | string) => {
                // Convert to utf8 and insert rest from previos
                let output: string = '';
                if (typeof chunk === 'string') {
                    output = `${this._rest}${chunk}`;
                } else {
                    output = `${this._rest}${chunk.toString('utf8')}`;
                }
                // Remove double carret
                output = output.replace(CRegCarrets, '\n').replace(/\n{2,}/g, '\n');
                // Get rest from the end
                const rest = this._getRest(output);
                this._rest = rest.rest;
                output = rest.cleared;
                // Convert to rows
                const rows: string[] = output.split(/[\n\r]/gi).filter((_) => _ !== '');
                this._rows.push(...rows.map((row: string) => {
                    const match: RegExpMatchArray | null = row.match(this._reg);
                    if (match === null) {
                        return { unixtime: -1, str: row };
                    }
                    if (match.length === 0) {
                        return { unixtime: -1, str: row };
                    }
                    const datetime: Date | undefined = this._getDateObj(match[0]);
                    let unixtime: number = datetime === undefined ? -1 : datetime.getTime();
                    // Check results
                    if (datetime === undefined) {
                        return { unixtime: unixtime, str: row };
                    }
                    // Apply offset if needed
                    if (this._offset !== 0) {
                        unixtime = unixtime + this._offset;
                    } else if (this._offset === 0 && this._zone !== '') {
                        const info = moment.tz(this._zone);
                        const offset: number = info.utcOffset();
                        unixtime = unixtime + offset;
                    }
                    return { unixtime: unixtime, str: row };
                }));
                resolve();
            }).catch((parseError: Error) => {
                reject(new Error(this._logger.error(`Error during parsing content of file: ${parseError.message}`)));
            });
        });
    }

    public getEarliestTime(): number | undefined {
        const earliest: { unixtime: number, index: number } | undefined = this._getEarliest();
        if (earliest === undefined) {
            return undefined;
        }
        return earliest.unixtime;
    }

    public getEarliestChunk(): string {
        const earliest: { unixtime: number, index: number } | undefined = this._getEarliest();
        if (earliest === undefined) {
            return '';
        }
        const chunk: string = `${this._rows.slice(0, earliest.index + 1).map((_) => _.str).join('\n')}\n`;
        this._rows.splice(0, earliest.index + 1);
        return chunk;
    }

    public isFinished(): boolean {
        return this._rows.length === 0;
    }

    public getRest(): string | undefined {
        if (this._rest === '') {
            return undefined;
        }
        return `${this._parserFunc.rest()}${this._rest}\n`;
    }

    public hasValidDate(): boolean {
        for (let i = this._rows.length - 1; i >= 0; i -= 1) {
            if (this._rows[i].unixtime !== -1) {
                return true;
            }
        }
        return false;
    }

    private _getEarliest(): { unixtime: number, index: number } | undefined {
        for (let i = 0, max = this._rows.length - 1; i <= max; i += 1) {
            const row: IRow = this._rows[i];
            if (row.unixtime !== -1) {
                return { unixtime: row.unixtime, index: i };
            }
        }
        return undefined;
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

    private _getParserFunc(parserName: string): IFileParserFunc | undefined {
        // Get file parser
        const parserClass = ServiceFileParsers.getParser(parserName);
        if (parserClass === undefined) {
            return undefined;
        }
        const fileParser: AFileParser = new parserClass();
        return fileParser.getParserFunc();
    }

    private _getDateObj(str: string): Date | undefined {
        let datetime: Date;
        if (this._format !== '') {
            // Extract date based on format
            try {
                datetime = moment(str, this._format).toDate();
            } catch (e) {
                return undefined;
            }
        } else {
            // Find date without format
            if (str.replace(/\d*\.?\d*/i, '') === '') {
                // timestamp looks like unix time
                datetime = new Date(parseInt(str, 10));
            } else {
                // Try to convert to date
                datetime = new Date(str);
            }
        }
        return this._isDateValid(datetime) ? datetime : undefined;
    }

}
