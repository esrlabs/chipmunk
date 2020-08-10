import { Subject, Observable } from 'rxjs';
import { IPCMessages } from '../services/service.electron.ipc';
import { CancelablePromise } from 'chipmunk.client.toolkit';
import { getUniqueColorTo, getColorHolder } from '../theme/colors';
import { EKey } from '../services/standalone/service.output.redirections';

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
    alias?: string;
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

export interface DefaultDateParts {
    day: number | undefined;
    month: number | undefined;
    year: number | undefined;
}

export interface IRangeOptions {
    color?: string;
    id?: number;
    alias?: string;
    group?: number;
}

export interface IAddRange {
    from: IRow;
    to: IRow;
    options: IRangeOptions;
}

export enum EChartMode {
    aligned = 'aligned',
    scaled = 'scaled'
}

export class ControllerSessionTabTimestamp {
    readonly ROW_PARSER_ID: string = 'timestamps-row-parser';
    readonly ROW_TOOLTIP_ID: string = 'timestamps-row-tooltip';
    readonly ROW_HANDLER_ID: string = 'timestamps-row-handler';

    private _guid: string;
    private _logger: Toolkit.Logger;
    private _tasks: Map<string, CancelablePromise<any, any, any, any>> = new Map();
    private _format: IFormat[] = [];
    private _ranges: IRange[] = [];
    private _open: IRow | undefined;
    private _state: IState = { min: Infinity, max: -1, duration: 0 };
    private _sequences: {
        range: number,
        group: number,
    } = {
        range: 0,
        group: 0,
    };
    private _parser: TimestampRowParser;
    private _mode: EChartMode = EChartMode.scaled;
    private _optimization: boolean = true;
    private _defaults: DefaultDateParts = {
        day: undefined,
        month: undefined,
        year: undefined,
    };
    private _subjects: {
        update: Subject<IRange[]>,
        formats: Subject<void>,
        defaults: Subject<DefaultDateParts>,
        mode: Subject<EChartMode>,
        zoom: Subject<void>,
        optimization: Subject<boolean>,
    } = {
        update: new Subject(),
        formats: new Subject(),
        defaults: new Subject(),
        mode: new Subject(),
        zoom: new Subject(),
        optimization: new Subject(),
    };
    private _cursor: {
        left: number,
        right: number,
    } = {
        left: 0,
        right: 0,
    };
    private _colors: string[] = [];

    constructor(guid: string) {
        this._guid = guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabTimestamp: ${guid}`);
        this._parser = new TimestampRowParser(this._injectHighlightFormat.bind(this));
        OutputParsersService.setSessionParser(this.ROW_PARSER_ID, this._parser, this._guid);
        OutputParsersService.setSessionTooltip({ id: this.ROW_TOOLTIP_ID, getContent: this._getTooltipContent.bind(this)}, this._guid);
        OutputParsersService.setSessionClickHandler(this.ROW_HANDLER_ID, this._handleRowClick.bind(this), this._guid);
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
        update: Observable<IRange[]>,
        formats: Observable<void>,
        defaults: Observable<DefaultDateParts>,
        mode: Observable<EChartMode>,
        zoom: Observable<void>,
        optimization: Observable<boolean>,
    } {
        return {
            update: this._subjects.update.asObservable(),
            formats: this._subjects.formats.asObservable(),
            defaults: this._subjects.defaults.asObservable(),
            mode: this._subjects.mode.asObservable(),
            zoom: this._subjects.zoom.asObservable(),
            optimization: this._subjects.optimization.asObservable(),
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

    public open(row: IRow, join?: boolean) {
        if (this._open !== undefined) {
            // Range already opened
            return;
        }
        this.getTimestamp(row.str).then((tm: number | undefined) => {
            if (tm === undefined) {
                return;
            }
            // Store timestamp
            row.timestamp = tm;
            // Detect matches
            row.match = this.getMatch(row.str);
            // Store opened point
            this._open = row;
            // Update group
            if (!join) {
                this._sequences.group += 1;
            }
            // Redraw rows (to show matches)
            OutputParsersService.updateRowsView();
        }).catch((err: Error) => {
            this._logger.error(`open:: Fail get timestamp due error: ${err.message}`);
        });
    }

    public close(row: IRow): Promise<void> {
        return new Promise((resolve) => {
            if (this._open === undefined) {
                return resolve();
            }
            this.getTimestamp(row.str).then((tm: number) => {
                row.timestamp = tm;
                if (row.timestamp === undefined) {
                    return resolve();
                }
                row.match = this.getMatch(row.str);
                if (this._open.timestamp > row.timestamp) {
                    const backup = this._open;
                    this._open = row;
                    row = backup;
                }
                this._ranges.push({
                    id: ++this._sequences.range,
                    start: this._open,
                    end: row,
                    duration: Math.abs(row.timestamp - this._open.timestamp),
                    color: this.getColor(),
                    group: this._sequences.group,
                });
                this._open = undefined;
                this._subjects.update.next(this.getRanges());
                this._setState();
                OutputParsersService.updateRowsView();
                return resolve();
            }).catch((err: Error) => {
                this._logger.error(`addRange:: Fail get timestamp due error: ${err.message}`);
                return resolve();
            });
        });
    }

    public addRange(range: IAddRange[] | IAddRange) {
        let ranges: IAddRange[] = !(range instanceof Array) ? [range] : range;
        if (ranges.length === 0) {
            return;
        }
        const cache_tm: {[key: string]: number } = {};
        const cache_match: {[key: string]: string } = {};
        ranges.forEach((r: {from: IRow, to: IRow}) => {
            if (cache_tm[r.from.str] === undefined && r.from.timestamp === undefined) {
                cache_tm[r.from.str] = -1;
            }
            if (cache_tm[r.to.str] === undefined && r.to.timestamp === undefined) {
                cache_tm[r.to.str] = -1;
            }
        });
        Promise.all(Object.keys(cache_tm).map((str: string) => {
            return this.getTimestamp(str).then((tm: number) => {
                cache_tm[str] = tm;
            }).catch((err: Error) => {
                this._logger.warn(`Fail to detect timestamp due error: ${err.message}`);
            });
        })).then(() => {
            ranges = ranges.map((r: IAddRange) => {
                if (r.from.timestamp === undefined) {
                    r.from.timestamp = cache_tm[r.from.str];
                }
                if (r.to.timestamp === undefined) {
                    r.to.timestamp = cache_tm[r.from.str];
                }
                [r.from.str, r.to.str].forEach((str: string) => {
                    if (cache_match[str] === undefined) {
                        cache_match[str] = this.getMatch(str);
                    }
                });
                r.from.match = cache_match[r.from.str];
                r.to.match = cache_match[r.to.str];
                if (r.from.timestamp > r.to.timestamp) {
                    const backup = r.from;
                    r.from = r.to;
                    r.to = backup;
                }
                return r;
            });
            this._ranges = this._ranges.concat(ranges.map((r: IAddRange) => {
                return {
                    id: r.options.id === undefined ? (++this._sequences.range) : r.options.id,
                    start: r.from,
                    end: r.to,
                    alias: r.options.alias === undefined ? undefined : r.options.alias,
                    duration: Math.abs(r.to.timestamp - r.from.timestamp),
                    color: r.options.color === undefined ? this.getColor() : r.options.color,
                    group: r.options.group === undefined ? ++this._sequences.group : r.options.group,
                };
            }));
            this._subjects.update.next(this.getRanges());
            this._setState();
            OutputParsersService.updateRowsView();
        }).catch((err: Error) => {
            this._logger.warn(`Fail to detect time range due error: ${err.message}`);
        });
    }

    public removeRange(smth: number | string) {
        if (typeof smth === 'number') {
            // Remove by ID
            this._ranges = this._ranges.filter((range: IRange) => {
                if (range.id === smth) {
                    this._colors = this._colors.filter((color: string) => {
                        return color !== range.color;
                    });
                }
                return range.id !== smth;
            });
        } else if (typeof smth === 'string') {
            // Remove by alias
            this._ranges = this._ranges.filter((range: IRange) => {
                if (range.alias === smth) {
                    this._colors = this._colors.filter((color: string) => {
                        return color !== range.color;
                    });
                }
                return range.alias !== smth;
            });
        }
        this._subjects.update.next(this.getRanges());
        this._setState();
        OutputParsersService.updateRowsView();
    }

    public setRangeColor(target: number | string, color: string) {
        const getColor: (index: number) => string = getColorHolder(color);
        let groupCursor: number = 0;
        let prevGroup: number = -1;
        this._ranges = this._ranges.map((range: IRange) => {
            if (typeof target === 'number' && range.id === target) {
                range.color = color;
            } else if (typeof target === 'string' && range.alias === target) {
                if (prevGroup !== range.group) {
                    groupCursor = 0;
                } else {
                    groupCursor += 1;
                }
                prevGroup = range.group;
                range.color = getColor(groupCursor);
            }
            return range;
        });
        this._subjects.update.next(this.getRanges());
        this._setState();
        OutputParsersService.updateRowsView();
    }

    public drop() {
        if (this._open === undefined) {
            return;
        }
        this._open = undefined;
        this._subjects.update.next(this.getRanges());
        this._setState();
        OutputParsersService.updateRowsView();
    }

    public clear(exceptions: number[] = []) {
        this._ranges = this._ranges.filter((range: IRange) => {
            if (exceptions.indexOf(range.id) === -1) {
                this._colors = this._colors.filter((color: string) => {
                    return color !== range.color;
                });
            }
            return exceptions.indexOf(range.id) !== -1;
        });
        this._open = undefined;
        this._subjects.update.next(this.getRanges());
        this._setState();
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

    public discover(update: boolean = false): CancelablePromise<void> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<void> = new CancelablePromise<void>(
            (resolve, reject, cancel, refCancelCB, self) => {
            if (this._format.length > 0 && !update) {
                return resolve();
            }
            this._format = [];
            ElectronIpcService.request(new IPCMessages.TimestampDiscoverRequest({
                session: this._guid,
                id: id,
            }), IPCMessages.TimestampDiscoverResponse).then((response: IPCMessages.TimestampDiscoverResponse) => {
                if (typeof response.error === 'string') {
                    this._logger.error(`Fail to discover files due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                if (response.format === undefined) {
                    return reject(new Error(`Format isn't detected.`));
                }
                const regexp: RegExp | Error = Toolkit.regTools.createFromStr(response.format.regex, response.format.flags.join(''));
                if (regexp instanceof Error) {
                    this._logger.warn(`Fail convert "${response.format.regex}" to RegExp due error: ${regexp.message}`);
                    return reject(regexp);
                }
                this._format.push({
                    format: response.format.format,
                    regexp: regexp,
                });
                this._subjects.formats.next();
                OutputParsersService.updateRowsView();
                resolve();
            }).catch((disErr: Error) => {
                this._logger.error(`Fail to discover files due error: ${disErr.message}`);
                return reject(disErr);
            });
        }).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    public validate(format: string): CancelablePromise<RegExp> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<RegExp> = new CancelablePromise<RegExp>(
            (resolve, reject, cancel, refCancelCB, self) => {
            ElectronIpcService.request(new IPCMessages.TimestampTestRequest({
                session: this._guid,
                format: format,
                id: id,
                flags: { miss_year: true, miss_month: true, miss_day: true }
            }), IPCMessages.TimestampTestResponse).then((response: IPCMessages.TimestampTestResponse) => {
                if (typeof response.error === 'string') {
                    this._logger.error(`Fail to test files due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                const regexp: RegExp | Error = Toolkit.regTools.createFromStr(response.format.regex, response.format.flags.join(''));
                if (regexp instanceof Error) {
                    this._logger.warn(`Fail convert "${response.format.regex}" to RegExp due error: ${regexp.message}`);
                    return reject(regexp);
                }
                resolve(regexp);
            }).catch((disErr: Error) => {
                this._logger.error(`Fail to test files due error: ${disErr.message}`);
                return reject(disErr);
            });
        }).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    public extract(str: string, format: string): CancelablePromise<number> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<number> = new CancelablePromise<number>(
            (resolve, reject, cancel, refCancelCB, self) => {
            ElectronIpcService.request(new IPCMessages.TimestampExtractRequest({
                session: this._guid,
                str: str,
                format: format,
                id: id,
                replacements: {
                    year: this.getDefaults().year,
                    month: this.getDefaults().month,
                    day: this.getDefaults().day,
                },
            }), IPCMessages.TimestampExtractResponse).then((response: IPCMessages.TimestampExtractResponse) => {
                if (typeof response.error === 'string') {
                    this._logger.error(`Fail to extract timestamp due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                resolve(response.timestamp);
            }).catch((disErr: Error) => {
                this._logger.error(`Fail to test files due error: ${disErr.message}`);
                return reject(disErr);
            });
        }).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    public isDetected(): boolean {
        return this._format.length > 0;
    }

    public getRangeIdByPosition(position: number): number | undefined {
        const range: IRange | undefined = this._getRangeByPosition(position);
        return range === undefined ? undefined : range.id;
    }

    public getOpenRow(): IRow | undefined {
        return this._open === undefined ? undefined : Object.assign({}, this._open);
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
        const range: IRange | undefined = this._getRangeByPosition(position);
        return range === undefined ? undefined : range.color;
    }

    public getStatePositionInRange(position: number): 'begin' | 'middle' | 'end' | 'end nested' | 'open' | undefined {
        if (this._open !== undefined && this._open.position === position) {
            return 'open';
        }
        const range: IRange | undefined = this._getRangeByPosition(position);
        const start: number | undefined = range === undefined ? undefined : (range.start.position < range.end.position ? range.start.position : range.end.position);
        const end: number | undefined = range === undefined ? undefined : (range.start.position > range.end.position ? range.start.position : range.end.position);
        const after: IRange | undefined = start === undefined ? undefined : this._getRangeByPosition(end, range.id);
        if (range === undefined) {
            return undefined;
        }
        if (range.start.position === position) {
            return 'begin';
        }
        if (range.end.position === position) {
            if (after !== undefined && after.group === range.group) {
                return 'end nested';
            } else {
                return 'end';
            }
        }
        return 'middle';
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

    public setOptimization(optimization: boolean) {
        this._optimization = optimization;
        this.setZoomOffsets(0, 0);
        this._subjects.optimization.next(optimization);
    }

    public getOptimization(): boolean {
        return this._optimization;
    }

    public getMinTimestamp(): number {
        return Math.min(...this._ranges.map((range: IRange) => {
            return range.end === undefined ? range.start.timestamp : Math.min(range.start.timestamp, range.end.timestamp);
        }));
    }

    public getMaxTimestamp(): number {
        return Math.max(...this._ranges.map((range: IRange) => {
            return range.end === undefined ? range.start.timestamp : Math.max(range.start.timestamp, range.end.timestamp);
        }));
    }

    public setZoomOffsets(left: number, right: number) {
        this._cursor.left = left < 0 ? 0 : left;
        this._cursor.right = right < 0 ? 0 : right;
        this._subjects.zoom.next();
    }

    public getCursorState(): {
        left: number,
        right: number,
    } {
        return {
            left: this._cursor.left,
            right: this._cursor.right,
        };
    }

    public getColor(): string {
        const color = getUniqueColorTo(this._colors);
        if (this._colors.length > 50) {
            this._colors.splice(0, 1);
        }
        this._colors.push(color);
        return color;
    }

    public getNextGroup(): number {
        return ++this._sequences.group;
    }

    private _getRangeByPosition(position: number, exception?: number): IRange | undefined {
        let range: IRange | undefined;
        this._ranges.forEach((r: IRange) => {
            if (range !== undefined) {
                return;
            }
            if (r.id === exception) {
                return;
            }
            if (r.start.position === position) {
                range = r;
            } else if (r.end !== undefined && r.start.position < r.end.position && r.start.position <= position && r.end.position >= position) {
                range = r;
            } else if (r.end !== undefined && r.start.position > r.end.position && r.start.position >= position && r.end.position <= position) {
                range = r;
            }
        });
        return range;
    }

    private _handleRowClick(str: string, position: number, hold?: EKey): boolean {
        if (this._open === undefined) {
            return false;
        }
        const row: IRow = {
            str: str,
            position: position,
        };
        this.close(row).then(() => {
            if (hold === EKey.ctrl) {
                return;
            }
            this.open(row, true);
        }).catch((closeErr: Error) => {
            this._logger.warn(`Fail close range due error: ${closeErr.message}`);
        });
        return true;
    }

    private _getTooltipContent(row: string, position: number, selection: string): Promise<string | undefined> {
        return new Promise((resolve) => {
            if (this._open === undefined) {
                return resolve(selection);
            }
            this.getTimestamp(selection).then((tm: number | undefined) => {
                resolve(`${Math.abs(this._open.timestamp - tm)}ms`);
            }).catch((err: Error) => {
                this._logger.error(`injectHighlight:: Fail get timestamp due error: ${err.message}`);
                resolve(undefined);
            });
        });
    }

    private _injectHighlightFormat(str: string): string {
        if (this._open === undefined) {
            return str;
        }
        this._format.forEach((format: IFormat) => {
            str = str.replace(format.regexp, (_match: string) => {
                return `<span class="tooltip timestampmatch" ${OutputParsersService.getTooltipHook(this.ROW_TOOLTIP_ID)} ${OutputParsersService.getClickHandlerHook(this.ROW_HANDLER_ID)}>${_match}</span>`;
            });
        });
        return str;
    }

    private _setState() {
        const duration: number = this._state.duration;
        this._state = {
            min: Math.min(...this._ranges.map((r) => {
                return r.end === undefined ? r.start.timestamp : Math.min(r.start.timestamp, r.end.timestamp);
            })),
            max: Math.max(...this._ranges.map((r) => {
                return r.end === undefined ? r.start.timestamp : Math.max(r.start.timestamp, r.end.timestamp);
            })),
            duration: 0,
        };
        this._state.duration = Math.abs(this._state.min - this._state.max);
        if (this._cursor.left !== 0) {
            this._cursor.left = (this._cursor.left / duration) * this._state.duration;
        }
        if (this._cursor.right !== 0) {
            this._cursor.right = (this._cursor.right / duration) * this._state.duration;
        }
        if (((this._state.max - this._cursor.right) - (this._state.min + this._cursor.left) < 0) ||
            (this._ranges.length === 0 && (this._cursor.left + this._cursor.right) !== 0)) {
            this._cursor.left = 0;
            this._cursor.right = 0;
        }
        if (this._mode !== EChartMode.aligned) {
            this._subjects.zoom.next();
        }
    }

}
