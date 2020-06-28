import { Subject, Observable } from 'rxjs';
import { IPCMessages } from '../services/service.electron.ipc';
import { CancelablePromise } from 'chipmunk.client.toolkit';

import ElectronIpcService from '../services/service.electron.ipc';
import OutputParsersService from '../services/standalone/service.output.parsers';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IRow {
    position: number;
    str: string;
    timestamp?: number;
    match?: string;
}

export interface IRange {
    id: number;
    start: IRow;
    end: IRow | undefined;
    duration: number;
    color: string;
    group: number;
}

export interface IState {
    min: number;
    max: number;
    duration: number;
}

export interface IFormat {
    format: string;
    regexp: RegExp;
}

class TimestampRowParser extends Toolkit.RowCommonParser {

    private _parser: (str: string) => string;

    constructor(parser: (str: string) => string) {
        super();
        this._parser = parser;
    }
    public parse(str: string, themeTypeRef: Toolkit.EThemeType, row: Toolkit.IRowInfo): string {
        return this._parser(str);
    }

}

const ROW_PARSER_ID = 'timestamps-row-parser';
const ROW_TOOLTIP_ID = 'timestamps-row-tooltip';

export interface DefaultDateParts {
    day: number | undefined;
    month: number | undefined;
    year: number | undefined;
}

export enum EChartMode {
    aligned = 'aligned',
    scaled = 'scaled'
}

export class ControllerSessionTabTimestampRanges {

    private _guid: string;
    private _logger: Toolkit.Logger;
    private _format: IFormat[] = [];
    private _ranges: IRange[] = [];
    private _state: IState = { min: Infinity, max: -1, duration: 0 };
    private _sequences: {
        range: number,
        group: number,
    } = {
        range: 0,
        group: 0,
    };
    private _last: IRow | undefined;
    private _parser: TimestampRowParser;
    private _mode: EChartMode = EChartMode.aligned;
    private _defaults: DefaultDateParts = {
        day: undefined,
        month: undefined,
        year: undefined,
    };
    private _subjects: {
        change: Subject<IRange>,
        update: Subject<IRange[]>,
        formats: Subject<void>,
        defaults: Subject<DefaultDateParts>,
        mode: Subject<EChartMode>
    } = {
        change: new Subject(),
        update: new Subject(),
        formats: new Subject(),
        defaults: new Subject(),
        mode: new Subject(),
    };

    constructor(guid: string) {
        this._guid = guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabTimestampRanges: ${guid}`);
        this._parser = new TimestampRowParser(this._injectHighlightFormat.bind(this));
        OutputParsersService.setSessionParser(ROW_PARSER_ID, this._parser, this._guid);
        OutputParsersService.setSessionTooltip({ id: ROW_TOOLTIP_ID, getContent: this._getTooltipContent.bind(this)}, this._guid);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._tasks.size === 0) {
                this._logger.debug(`No active tasks; no need to abort any.`);
                return resolve();
            }
            Promise.all(Array.from(this._tasks.values()).map((task: CancelablePromise<any, any, any, any>) => {
                return new Promise((resolveTask) => {
                    task.canceled(resolveTask);
                    task.abort('Controller is going to be destroyed');
                });
            })).then(() => {
                resolve();
                this._logger.debug(`All tasks are aborted; controller is destroyed.`);
            }).catch((err: Error) => {
                this._logger.error(`Unexpected error during destroying: ${err.message}`);
                reject(err);
            });
        });
    }

    public getObservable(): {
        change: Observable<IRange>,
        update: Observable<IRange[]>,
        formats: Observable<void>,
        defaults: Observable<DefaultDateParts>,
        mode: Observable<EChartMode>,
    } {
        return {
            change: this._subjects.change.asObservable(),
            update: this._subjects.update.asObservable(),
            formats: this._subjects.formats.asObservable(),
            defaults: this._subjects.defaults.asObservable(),
            mode: this._subjects.mode.asObservable(),
        };
    }

    public getState(): IState {
        return this._state;
    }

    public getFormats(): IFormat[] {
        return this._format.map((format: IFormat) => {
            return { format: format.format, regexp: format.regexp };
        });
    }

    public setPoint(row: IRow) {
        this.getTimestamp(row.str).then((tm: number | undefined) => {
            if (tm === undefined) {
                return;
            }
            const index: number = this.getOpenRangeIndex();
            row.timestamp = tm;
            row.match = this.getMatch(row.str);
            if (index === -1) {
                this._ranges.push({
                    id: ++this._sequences.range,
                    start: row,
                    end: undefined,
                    duration: -1,
                    color: this._getColor(),
                    group: ++this._sequences.group,
                });
                this._last = this._ranges[this._ranges.length - 1].start;
                this._setState();
                this._subjects.update.next(this.getRanges());
            } else {
                this._ranges[index].start = this._last;
                this._ranges[index].end = row;
                this._ranges[index].duration = Math.abs(this._ranges[index].start.timestamp - this._ranges[index].end.timestamp);
                if (this._ranges[index].end.timestamp < this._ranges[index].start.timestamp) {
                    const backup = this._ranges[index].end;
                    this._ranges[index].end = this._ranges[index].start;
                    this._ranges[index].start = backup;
                }
                this._last = undefined;
                this._setState();
                this._subjects.change.next(Toolkit.copy(this._ranges[index]));
            }
            OutputParsersService.updateRowsView();
        }).catch((err: Error) => {
            this._logger.error(`setPoint:: Fail get timestamp due error: ${err.message}`);
        });
    }

    public addRange(start: IRow, end: IRow) {
        Promise.all([
            this.getTimestamp(start.str),
            this.getTimestamp(end.str),
        ]).then((timestamps: Array<number | undefined>) => {
            start.timestamp = timestamps[0];
            end.timestamp = timestamps[1];
            if (start.timestamp === undefined || end.timestamp === undefined) {
                return;
            }
            [start, end].forEach((row: IRow) => {
                row.match = this.getMatch(row.str);
            });
            if (end.timestamp < start.timestamp) {
                const backup = end;
                end = start;
                start = backup;
            }
            this._ranges.push({
                id: ++this._sequences.range,
                    start: start,
                    end: end,
                    duration: Math.abs(end.timestamp - start.timestamp),
                    color: this._getColor(),
                    group: this.getCurrentGroup(),
            });
            this._last = Object.assign({}, end);
            this._setState();
            this._subjects.update.next(this.getRanges());
            OutputParsersService.updateRowsView();
        }).catch((err: Error) => {
            this._logger.error(`addRange:: Fail get timestamp due error: ${err.message}`);
        });
    }

    public removeRange(id: number) {
        this._ranges = this._ranges.filter((range: IRange) => {
            return range.id !== id;
        });
        this._subjects.update.next(this.getRanges());
    }

    public dropOpenRange() {
        const index: number | undefined = this.getOpenRangeIndex();
        if (index === undefined) {
            return;
        }
        this._ranges.splice(index, 1);
        this._last = undefined;
        this._setState();
        this._subjects.update.next(this.getRanges());
        OutputParsersService.updateRowsView();
    }

    public drop(exceptions: number[] = []) {
        this._ranges = this._ranges.filter((row: IRange) => {
            return exceptions.indexOf(row.id) !== -1;
        });
        this._last = undefined;
        this._setState();
        this._subjects.update.next(this.getRanges());
        OutputParsersService.updateRowsView();
    }

    public getTimestamp(str: string): Promise<number | undefined> {
        return new Promise((resolve, reject) => {
            if (this._format.length === 0) {
                return resolve(undefined);
            }
            let inputStr: string | undefined;
            let formatStr: string | undefined;
            this._format.forEach((format: IFormat) => {
                if (inputStr !== undefined) {
                    return;
                }
                const match: RegExpMatchArray | null = str.match(format.regexp);
                if (match === null || match.length === 0) {
                    return undefined;
                }
                inputStr = match[0];
                formatStr = format.format;
            });
            if (inputStr === undefined) {
                return resolve(undefined);
            }
            this.extract(inputStr, formatStr).then((timestamp: number) => {
                resolve(timestamp);
            }).catch(reject);
        });
    }

    public getMatch(str: string): string | undefined {
        let match: string | undefined;
        this._format.forEach((format: IFormat) => {
            if (match !== undefined) {
                return;
            }
            const matches: RegExpMatchArray | null = str.match(format.regexp);
            if (matches === null || matches.length === 0) {
                return undefined;
            }
            match = matches[0];
        });
        return match;
    }

    public isDetected(): boolean {
        return this._format.length > 0;
    }

    public getRangeIdByPosition(position: number): number {
        let id: number | undefined;
        this._ranges.forEach((r: IRange) => {
            if (id !== undefined) {
                return;
            }
            if (r.start.position === position) {
                id = r.id;
            } else if (r.end !== undefined && r.start.position < r.end.position && r.start.position <= position && r.end.position >= position) {
                id = r.id;
            } else if (r.end !== undefined && r.start.position > r.end.position && r.start.position >= position && r.end.position <= position) {
                id = r.id;
            }
        });
        return id;
    }

    public getOpenRangeIndex(): number {
        return this._ranges.findIndex((r: IRange) => {
            return r.end === undefined;
        });
    }

    public getLastPointTimestamp(): number | undefined {
        return this._last === undefined ? undefined : this._last.timestamp;
    }

    public getLastPointPosition(): number | undefined {
        return this._last === undefined ? undefined : this._last.position;
    }

    public getCurrentGroup(): number | undefined {
        return this._sequences.group;
    }

    public getLastPointRow(): IRow | undefined {
        return this._last === undefined ? undefined : this._last;
    }

    public getRanges(): IRange[] {
        return this._ranges.map((r: IRange) => {
            return Toolkit.copy(r);
        });
    }

    public getCount(): number {
        return this._ranges.length;
    }

    public getRangeColorFor(position: number): string | undefined {
        let color: string | undefined;
        this._ranges.forEach((r: IRange) => {
            if (color !== undefined) {
                return;
            }
            if (r.start.position === position) {
                color = r.color;
            } else if (r.end !== undefined && r.start.position < r.end.position && r.start.position <= position && r.end.position >= position) {
                color = r.color;
            } else if (r.end !== undefined && r.start.position > r.end.position && r.start.position >= position && r.end.position <= position) {
                color = r.color;
            }
        });
        return color;
    }

    public removeFormatDef(format: string) {
        this._format = this._format.filter(f => f.format !== format);
        this._subjects.formats.next();
        OutputParsersService.updateRowsView();
    }

    public addFormat(format: IFormat) {
        this._format.push(format);
        this._subjects.formats.next();
        OutputParsersService.updateRowsView();
    }

    public setDefaults(replacements: DefaultDateParts) {
        this._defaults = replacements;
        this._subjects.defaults.next(replacements);
    }

    public getDefaults(): DefaultDateParts {
        return this._defaults;
    }

    public setMode(mode: EChartMode) {
        this._mode = mode;
        this._subjects.mode.next(mode);
    }

    public getMode(): EChartMode {
        return this._mode;
    }

    public getMinTimestamp(): number {
        return Math.min(...this._ranges.map((range: IRange) => {
            if (range.end !== undefined) {
                return range.start.timestamp < range.end.timestamp ? range.start.timestamp : range.end.timestamp;
            } else {
                return range.start.timestamp;
            }
        }));
    }

    public getMaxTimestamp(): number {
        return Math.max(...this._ranges.map((range: IRange) => {
            if (range.end !== undefined) {
                return range.start.timestamp > range.end.timestamp ? range.start.timestamp : range.end.timestamp;
            } else {
                return range.start.timestamp;
            }
        }));
    }

    private _getTooltipContent(row: string, position: number, selection: string): Promise<string | undefined> {
        return new Promise((resolve) => {
            if (this._last === undefined) {
                return resolve(selection);
            }
            this.getTimestamp(selection).then((tm: number | undefined) => {
                resolve(`${Math.abs(this._last.timestamp - tm)}ms`);
            }).catch((err: Error) => {
                this._logger.error(`injectHighlight:: Fail get timestamp due error: ${err.message}`);
                resolve(undefined);
            });
        });
    }

    private _injectHighlightFormat(str: string): string {
        if (this._last === undefined) {
            return str;
        }
        this._format.forEach((format: IFormat) => {
            str = str.replace(format.regexp, (_match: string) => {
                return `<span class="tooltip timestampmatch" ${OutputParsersService.getTooltipHook(ROW_TOOLTIP_ID)}>${_match}</span>`;
            });
        });
        return str;
    }

    private _getColor(): string {
        return `rgb(${Math.round(Math.random() * 154) + 100}, ${Math.round(Math.random() * 154) + 100}, ${Math.round(Math.random() * 154) + 100})`;
    }

    private _setState() {
        this._state = { min: Infinity, max: -1, duration: 0 };
        this._ranges.forEach((r: IRange) => {
            if (this._state.min > r.start.timestamp) {
                this._state.min = r.start.timestamp;
            }
            if (this._state.max < r.start.timestamp) {
                this._state.max = r.start.timestamp;
            }
            if (r.end !== undefined) {
                if (this._state.min > r.end.timestamp) {
                    this._state.min = r.end.timestamp;
                }
                if (this._state.max < r.end.timestamp) {
                    this._state.max = r.end.timestamp;
                }
            }
        });
        this._state.duration = Math.abs(this._state.min - this._state.max);
    }

}
