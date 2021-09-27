import { Subject, Observable } from 'rxjs';
import { IPC } from '../../../../services/service.electron.ipc';
import { CancelablePromise } from 'chipmunk.client.toolkit';
import { getUniqueColorTo, getColorHolder } from '../../../../theme/colors';
import { EKey } from '../../../../services/standalone/service.output.redirections';
import { TimestampRowParser } from './session.dependency.timestamps.rowparser';
import { TimestampModifier } from './session.dependency.timestamps.modifier';
import { Importable } from '../../dependencies/importer/controller.session.importer.interface';
import { Dependency, SessionGetter } from '../session.dependency';

import ElectronIpcService from '../../../../services/service.electron.ipc';
import OutputParsersService from '../../../../services/standalone/service.output.parsers';

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

export interface IFormatDesc {
    format: string;
    regexp: string;
}

export interface ITimemeasureSession {
    formats: IFormatDesc[];
    ranges: IRange[];
    defaults: DefaultDateParts;
    mode: EChartMode;
    sequences: {
        range: number;
        group: number;
    };
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
    scaled = 'scaled',
}

export class ControllerSessionTabTimestamp
    extends Importable<ITimemeasureSession>
    implements Dependency
{
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
        range: number;
        group: number;
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
        update: Subject<IRange[]>;
        formats: Subject<void>;
        defaults: Subject<DefaultDateParts>;
        mode: Subject<EChartMode>;
        zoom: Subject<void>;
        optimization: Subject<boolean>;
        onExport: Subject<void>;
    } = {
        update: new Subject(),
        formats: new Subject(),
        defaults: new Subject(),
        mode: new Subject(),
        zoom: new Subject(),
        optimization: new Subject(),
        onExport: new Subject(),
    };
    private _cursor: {
        left: number;
        right: number;
    } = {
        left: 0,
        right: 0,
    };
    private _colors: string[] = [];
    private _session: SessionGetter;

    constructor(uuid: string, getter: SessionGetter) {
        super();
        this._session = getter;
        this._guid = uuid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabTimestamp: ${uuid}`);
        this._parser = new TimestampRowParser(this._injectHighlightFormat.bind(this));
        OutputParsersService.setSessionParser(this.ROW_PARSER_ID, this._parser, this._guid);
        OutputParsersService.setSessionTooltip(
            { id: this.ROW_TOOLTIP_ID, getContent: this._getTooltipContent.bind(this) },
            this._guid,
        );
        OutputParsersService.setSessionClickHandler(
            this.ROW_HANDLER_ID,
            this._handleRowClick.bind(this),
            this._guid,
        );
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._tasks.size === 0) {
                this._logger.debug(`No active tasks; no need to abort any.`);
                return resolve();
            }
            Promise.all(
                Array.from(this._tasks.values()).map(
                    (task: CancelablePromise<any, any, any, any>) => {
                        return new Promise((resolveTask) => {
                            task.canceled(resolveTask);
                            task.abort('Controller is going to be destroyed');
                        });
                    },
                ),
            )
                .then(() => {
                    resolve();
                    this._logger.debug(`All tasks are aborted; controller is destroyed.`);
                })
                .catch((err: Error) => {
                    this._logger.error(`Unexpected error during destroying: ${err.message}`);
                    reject(err);
                });
        });
    }

    public getName(): string {
        return 'ControllerSessionTabTimestamp';
    }

    public getObservable(): {
        update: Observable<IRange[]>;
        formats: Observable<void>;
        defaults: Observable<DefaultDateParts>;
        mode: Observable<EChartMode>;
        zoom: Observable<void>;
        optimization: Observable<boolean>;
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
        this.getTimestamp(row.str)
            .then((tm: number | undefined) => {
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
            })
            .catch((err: Error) => {
                this._logger.error(`open:: Fail get timestamp due error: ${err.message}`);
            });
    }

    public close(row: IRow): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._open === undefined) {
                return resolve();
            }
            this.getTimestamp(row.str)
                .then((tm: number | undefined) => {
                    if (this._open === undefined || this._open.timestamp === undefined) {
                        return reject(
                            new Error(
                                this._logger.warn(`Attempt to close timerange without open point`),
                            ),
                        );
                    }
                    if (tm === undefined) {
                        return resolve();
                    }
                    row.timestamp = tm;
                    row.match = this.getMatch(row.str);
                    if (
                        this._open.timestamp > row.timestamp ||
                        this._open.position > row.position
                    ) {
                        const backup = this._open;
                        this._open = row;
                        row = backup;
                    }
                    this._ranges.push({
                        id: ++this._sequences.range,
                        start: this._open,
                        end: row,
                        duration: Math.abs(
                            (row.timestamp as number) - (this._open.timestamp as number),
                        ),
                        color: this.getColor(),
                        group: this._sequences.group,
                    });
                    this._open = undefined;
                    this._subjects.update.next(this.getRanges());
                    this._setState();
                    OutputParsersService.updateRowsView();
                    return resolve();
                })
                .catch((err: Error) => {
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
        const cache_tm: { [key: string]: number } = {};
        const cache_match: { [key: string]: string } = {};
        ranges.forEach((r: { from: IRow; to: IRow }) => {
            if (cache_tm[r.from.str] === undefined && r.from.timestamp === undefined) {
                cache_tm[r.from.str] = -1;
            }
            if (cache_tm[r.to.str] === undefined && r.to.timestamp === undefined) {
                cache_tm[r.to.str] = -1;
            }
        });
        Promise.all(
            Object.keys(cache_tm).map((str: string) => {
                return this.getTimestamp(str)
                    .then((tm: number | undefined) => {
                        if (tm !== undefined) {
                            cache_tm[str] = tm;
                        } else {
                            delete cache_tm[str];
                        }
                    })
                    .catch((err: Error) => {
                        this._logger.warn(`Fail to detect timestamp due error: ${err.message}`);
                    });
            }),
        )
            .then(() => {
                ranges = ranges.map((r: IAddRange) => {
                    if (r.from.timestamp === undefined) {
                        r.from.timestamp = cache_tm[r.from.str];
                    }
                    if (r.to.timestamp === undefined) {
                        r.to.timestamp = cache_tm[r.from.str];
                    }
                    [r.from.str, r.to.str].forEach((str: string) => {
                        if (cache_match[str] === undefined) {
                            const match = this.getMatch(str);
                            if (match !== undefined) {
                                cache_match[str] = match;
                            } else {
                                delete cache_match[str];
                            }
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
                this._ranges = this._ranges.concat(
                    ranges
                        .map((r: IAddRange) => {
                            if (r.to === undefined || r.to.timestamp === undefined) {
                                return null;
                            }
                            if (r.from === undefined || r.from.timestamp === undefined) {
                                return null;
                            }
                            return {
                                id:
                                    r.options.id === undefined
                                        ? ++this._sequences.range
                                        : r.options.id,
                                start: r.from,
                                end: r.to,
                                alias: r.options.alias === undefined ? undefined : r.options.alias,
                                duration: Math.abs(r.to.timestamp - r.from.timestamp),
                                color:
                                    r.options.color === undefined
                                        ? this.getColor()
                                        : r.options.color,
                                group:
                                    r.options.group === undefined
                                        ? ++this._sequences.group
                                        : r.options.group,
                            };
                        })
                        .filter((r) => r !== null) as IRange[],
                );
                this._subjects.update.next(this.getRanges());
                this._setState();
                OutputParsersService.updateRowsView();
            })
            .catch((err: Error) => {
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
                    return undefined;
                }
                const match: RegExpMatchArray | null = str.match(format.regexp);
                if (match === null || match.length === 0) {
                    return undefined;
                }
                inputStr = match[0];
                formatStr = format.format;
                return undefined;
            });
            if (inputStr === undefined) {
                return resolve(undefined);
            }
            if (formatStr === undefined) {
                return reject(
                    new Error(this._logger.warn(`To get timestamp format should be defined`)),
                );
            }
            this.extract(inputStr, formatStr)
                .then((timestamp: number) => {
                    resolve(timestamp);
                })
                .catch(reject);
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
                return;
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
                ElectronIpcService.request<IPC.TimestampDiscoverResponse>(
                    new IPC.TimestampDiscoverRequest({
                        session: this._guid,
                        id: id,
                    }),
                    IPC.TimestampDiscoverResponse,
                )
                    .then((response) => {
                        if (typeof response.error === 'string') {
                            this._logger.error(
                                `Fail to discover files due error: ${response.error}`,
                            );
                            return reject(new Error(response.error));
                        }
                        if (response.format === undefined) {
                            return reject(new Error(`Format isn't detected.`));
                        }
                        const regexp: RegExp | Error = Toolkit.regTools.createFromStr(
                            response.format.regex,
                            response.format.flags.join(''),
                        );
                        if (regexp instanceof Error) {
                            this._logger.warn(
                                `Fail convert "${response.format.regex}" to RegExp due error: ${regexp.message}`,
                            );
                            return reject(regexp);
                        }
                        this._format.push({
                            format: response.format.format,
                            regexp: regexp,
                        });
                        this._subjects.formats.next();
                        OutputParsersService.updateRowsView();
                        resolve();
                    })
                    .catch((disErr: Error) => {
                        this._logger.error(`Fail to discover files due error: ${disErr.message}`);
                        return reject(disErr);
                    });
            },
        ).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    public validate(format: string): CancelablePromise<RegExp> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<RegExp> = new CancelablePromise<RegExp>(
            (resolve, reject, cancel, refCancelCB, self) => {
                ElectronIpcService.request<IPC.TimestampTestResponse>(
                    new IPC.TimestampTestRequest({
                        session: this._guid,
                        format: format,
                        id: id,
                        flags: { miss_year: true, miss_month: true, miss_day: true },
                    }),
                    IPC.TimestampTestResponse,
                )
                    .then((response) => {
                        if (typeof response.error === 'string') {
                            return reject(
                                new Error(
                                    this._logger.error(
                                        `Fail to test files due error: ${response.error}`,
                                    ),
                                ),
                            );
                        }
                        if (response.format === undefined) {
                            return reject(
                                new Error(
                                    this._logger.error(
                                        `Has been gotten invalid response with TimestampTestResponse. No format in`,
                                    ),
                                ),
                            );
                        }
                        const regexp: RegExp | Error = Toolkit.regTools.createFromStr(
                            response.format.regex,
                            response.format.flags.join(''),
                        );
                        if (regexp instanceof Error) {
                            this._logger.warn(
                                `Fail convert "${response.format.regex}" to RegExp due error: ${regexp.message}`,
                            );
                            return reject(regexp);
                        }
                        resolve(regexp);
                    })
                    .catch((disErr: Error) => {
                        this._logger.error(`Fail to test files due error: ${disErr.message}`);
                        return reject(disErr);
                    });
            },
        ).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    public extract(str: string, format: string): CancelablePromise<number> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<number> = new CancelablePromise<number>(
            (resolve, reject, cancel, refCancelCB, self) => {
                ElectronIpcService.request<IPC.TimestampExtractResponse>(
                    new IPC.TimestampExtractRequest({
                        session: this._guid,
                        str: str,
                        format: format,
                        id: id,
                        replacements: {
                            year: this.getDefaults().year,
                            month: this.getDefaults().month,
                            day: this.getDefaults().day,
                        },
                    }),
                    IPC.TimestampExtractResponse,
                )
                    .then((response) => {
                        if (typeof response.error === 'string') {
                            this._logger.error(
                                `Fail to extract timestamp due error: ${response.error}`,
                            );
                            return reject(new Error(response.error));
                        }
                        if (response.timestamp === undefined) {
                            return reject(
                                new Error(
                                    this._logger.error(
                                        `Has been gotten invalid response with TimestampExtractResponse. No timestamp in`,
                                    ),
                                ),
                            );
                        }
                        resolve(response.timestamp);
                    })
                    .catch((disErr: Error) => {
                        this._logger.error(`Fail to test files due error: ${disErr.message}`);
                        return reject(disErr);
                    });
            },
        ).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    public getRecent(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.TimestampFormatRecentResponse>(
                new IPC.TimestampFormatRecentRequest(),
                IPC.TimestampFormatRecentResponse,
            )
                .then((response) => {
                    if (typeof response.error === 'string') {
                        this._logger.error(
                            `Fail to get recent time formats due error: ${response.error}`,
                        );
                        return reject(new Error(response.error));
                    }
                    resolve(response.formats);
                })
                .catch((disErr: Error) => {
                    this._logger.error(
                        `Fail to request recent filters due error: ${disErr.message}`,
                    );
                    return reject(disErr);
                });
        });
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

    public getStatePositionInRange(
        position: number,
    ): 'begin' | 'middle' | 'end' | 'end nested' | 'open' | undefined {
        if (this._open !== undefined && this._open.position === position) {
            return 'open';
        }
        const range: IRange | undefined = this._getRangeByPosition(position);
        if (range === undefined || range.end === undefined) {
            return undefined;
        }
        const start: number | undefined =
            range === undefined
                ? undefined
                : range.start.position < range.end.position
                ? range.start.position
                : range.end.position;
        const end: number | undefined =
            range === undefined
                ? undefined
                : range.start.position > range.end.position
                ? range.start.position
                : range.end.position;
        const after: IRange | undefined =
            start === undefined
                ? undefined
                : end === undefined
                ? undefined
                : this._getRangeByPosition(end, range.id);
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
        this._format = this._format.filter((f) => f.format !== format);
        this._subjects.formats.next();
        OutputParsersService.updateRowsView();
    }

    public addFormat(format: IFormat) {
        if (this._format.find((f) => f.format === format.format) !== undefined) {
            return;
        }
        this._format.push(format);
        this._subjects.formats.next();
        OutputParsersService.updateRowsView();
        ElectronIpcService.send(
            new IPC.TimestampFormatRecentAdd({
                format: format.format,
            }),
        ).catch((err: Error) => {
            this._logger.warn(`Fail to save recent format due: ${err.message}`);
        });
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
        return Math.min(
            ...this._ranges.map((range: IRange) => {
                return this._mapRangeMin(range);
            }),
        );
    }

    public getMaxTimestamp(): number {
        return Math.max(
            ...this._ranges.map((range: IRange) => {
                return this._mapRangeMax(range);
            }),
        );
    }

    public setZoomOffsets(left: number, right: number) {
        this._cursor.left = left < 0 ? 0 : left;
        this._cursor.right = right < 0 ? 0 : right;
        this._subjects.zoom.next();
    }

    public getCursorState(): {
        left: number;
        right: number;
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

    public getExportObservable(): Observable<void> {
        return this._subjects.onExport.asObservable();
    }

    public getImporterUUID(): string {
        return 'timestamps_and_formats';
    }

    public export(): Promise<ITimemeasureSession | undefined> {
        return new Promise((resolve) => {
            if (this._format.length === 0) {
                return resolve(undefined);
            }
            resolve({
                formats: this._format.map((format: IFormat) => {
                    return { format: format.format, regexp: format.regexp.source };
                }),
                ranges: this._ranges.slice(),
                mode: this._mode,
                defaults: Object.assign({}, this._defaults),
                sequences: {
                    group: this._sequences.group,
                    range: this._sequences.range,
                },
            });
        });
    }

    public import(session: ITimemeasureSession): Promise<void> {
        return new Promise((resolve) => {
            this._format = session.formats
                .map((format: IFormatDesc) => {
                    const regexp: RegExp | Error = Toolkit.regTools.createFromStr(format.regexp);
                    if (regexp instanceof Error) {
                        this._logger.warn(
                            `Fail restore regexp "${format.regexp}" due error: ${regexp.message}`,
                        );
                        return null;
                    }
                    return { format: format.format, regexp: regexp };
                })
                .filter((f) => f !== null) as Array<{ format: string; regexp: RegExp }>;
            this._sequences = session.sequences;
            this._ranges = session.ranges;
            this._defaults = session.defaults;
            this._mode = session.mode;
            this._subjects.update.next(this.getRanges());
            this._setState(true);
            OutputParsersService.updateRowsView();
            this._subjects.formats.next();
            this._subjects.mode.next(session.mode);
            this._subjects.defaults.next(session.defaults);
            this._session()
                .getAPI()
                .openToolbarApp(
                    this._session().getAPI().getDefaultToolbarAppsIds().timemeasurement,
                    true,
                );
            resolve();
        });
    }

    private _mapRangeMinMax(range: IRange, min: boolean): number {
        if (range.end === undefined) {
            if (range.start === undefined || range.start.timestamp === undefined) {
                this._logger.error(
                    `Fail to do getMinTimestamp as soon as range.start is undefined.`,
                );
                return 0;
            }
            return range.start.timestamp;
        } else {
            if (range.start === undefined || range.start.timestamp === undefined) {
                this._logger.error(
                    `Fail to do getMinTimestamp as soon as range.start is undefined.`,
                );
                return 0;
            }
            if (range.end === undefined || range.end.timestamp === undefined) {
                this._logger.error(
                    `Fail to do getMinTimestamp as soon as range.end.timestamp is undefined.`,
                );
                return 0;
            }
            return min
                ? Math.min(range.start.timestamp, range.end.timestamp)
                : Math.max(range.start.timestamp, range.end.timestamp);
        }
    }

    private _mapRangeMin(range: IRange): number {
        return this._mapRangeMinMax(range, true);
    }

    private _mapRangeMax(range: IRange): number {
        return this._mapRangeMinMax(range, false);
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
            } else if (
                r.end !== undefined &&
                r.start.position < r.end.position &&
                r.start.position <= position &&
                r.end.position >= position
            ) {
                range = r;
            } else if (
                r.end !== undefined &&
                r.start.position > r.end.position &&
                r.start.position >= position &&
                r.end.position <= position
            ) {
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
        this.close(row)
            .then(() => {
                if (hold === EKey.ctrl) {
                    return;
                }
                this.open(row, true);
            })
            .catch((closeErr: Error) => {
                this._logger.warn(`Fail close range due error: ${closeErr.message}`);
            });
        return true;
    }

    private _getTooltipContent(
        row: string,
        position: number,
        selection: string,
    ): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            if (this._open === undefined) {
                return resolve(selection);
            }
            this.getTimestamp(selection)
                .then((tm: number | undefined) => {
                    if (
                        this._open === undefined ||
                        this._open.timestamp === undefined ||
                        tm === undefined
                    ) {
                        reject(new Error(`No open point for timerange`));
                    } else {
                        resolve(`${Math.abs(this._open.timestamp - tm)}ms`);
                    }
                })
                .catch((err: Error) => {
                    this._logger.error(
                        `injectHighlight:: Fail get timestamp due error: ${err.message}`,
                    );
                    resolve(undefined);
                });
        });
    }

    private _injectHighlightFormat(str: string): string | Toolkit.Modifier {
        const tags = {
            open: `<span class="tooltip timestampmatch" ${OutputParsersService.getTooltipHook(
                this.ROW_TOOLTIP_ID,
            )} ${OutputParsersService.getClickHandlerHook(this.ROW_HANDLER_ID)}>`,
            close: `</span>`,
        };
        if (this._open === undefined) {
            return new TimestampModifier([], str, tags);
        } else {
            return new TimestampModifier(
                this._format.map((f) => f.regexp),
                str,
                tags,
            );
        }
    }

    private _setState(noexport: boolean = false) {
        const duration: number = this._state.duration;
        this._state = {
            min: Math.min(
                ...this._ranges.map((r) => {
                    return this._mapRangeMin(r);
                }),
            ),
            max: Math.max(
                ...this._ranges.map((r) => {
                    return this._mapRangeMax(r);
                }),
            ),
            duration: 0,
        };
        this._state.duration = Math.abs(this._state.min - this._state.max);
        if (this._cursor.left !== 0) {
            this._cursor.left = (this._cursor.left / duration) * this._state.duration;
        }
        if (this._cursor.right !== 0) {
            this._cursor.right = (this._cursor.right / duration) * this._state.duration;
        }
        if (
            this._state.max - this._cursor.right - (this._state.min + this._cursor.left) < 0 ||
            (this._ranges.length === 0 && this._cursor.left + this._cursor.right !== 0)
        ) {
            this._cursor.left = 0;
            this._cursor.right = 0;
        }
        if (this._mode !== EChartMode.aligned) {
            this._subjects.zoom.next();
        }
        if (!noexport) {
            this._subjects.onExport.next();
        }
    }
}
