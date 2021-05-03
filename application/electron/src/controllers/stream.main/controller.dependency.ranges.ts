// tslint:disable: member-ordering
import * as Tools from '../../tools/index';

import ServiceElectron from '../../services/service.electron';
import Logger from '../../tools/env.logger';

import { Postman } from '../../tools/postman';
import { IPCMessages as IPC, Subscription } from '../../services/service.electron';
import {
    Session,
    Events,
    CancelablePromise,
    SessionSearch,
    SessionStream,
    IResultSearchElement,
    IFilter,
    IExtractDTFormatResult,
} from 'indexer-neon';
import { Dependency } from './controller.dependency';
import { Channel } from './controller.channel';
import { CommonInterfaces } from '../../interfaces/interface.common';
import { getSearchRegExp } from '../../../../common/functionlity/functions.search.requests';
import { IRange } from '../../../../common/interfaces/interface.timerange';

export interface IRangeDefinition {
    points: RegExp[];
    strict: boolean;
}

type TDestroyCallback = () => void;

export class Ranges extends Dependency {
    private readonly _logger: Logger;
    private readonly _subscriptions: {
        ipc: { [key: string]: Subscription };
    } = {
        ipc: {},
    };
    private readonly _session: Session;
    private readonly _channel: Channel;
    private readonly _tasks: Map<string, CancelablePromise<IResultSearchElement[]>> = new Map();
    private _destroy: TDestroyCallback | undefined;

    constructor(session: Session, channel: Channel) {
        super();
        this._logger = new Logger(`Ranges: ${session.getUUID()}`);
        this._session = session;
        this._channel = channel;
    }

    public getName(): string {
        return 'Ranges';
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Unsubscribe IPC messages / events
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            if (this._tasks.size === 0) {
                resolve();
            } else {
                this._destroy = resolve;
            }
        });
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._ipc().subscribe().then(resolve).catch(reject);
        });
    }

    private _ipc(): {
        subscribe(): Promise<void>;
        unsubscribe(): void;
        handlers: {
            search(
                msg: IPC.TimerangeSearchRequest,
                response: (isntance: IPC.TimerangeSearchResponse) => any,
            ): void;
        };
    } {
        const self = this;
        return {
            subscribe(): Promise<void> {
                return Promise.all([
                    ServiceElectron.IPC.subscribe(
                        IPC.TimerangeSearchRequest,
                        self._ipc().handlers.search as any,
                    )
                        .then((subscription: Subscription) => {
                            self._subscriptions.ipc.search = subscription;
                        })
                        .catch((error: Error) => {
                            return Promise.reject(
                                self._logger.warn(
                                    `Fail to subscribe to render event "TimerangeSearchRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`,
                                ),
                            );
                        }),
                ]).then(() => {
                    return Promise.resolve();
                });
            },
            unsubscribe(): void {
                Object.keys(self._subscriptions.ipc).forEach((key: string) => {
                    self._subscriptions.ipc[key].destroy();
                });
            },
            handlers: {
                search(
                    msg: IPC.TimerangeSearchRequest,
                    response: (isntance: IPC.TimerangeSearchResponse) => any,
                ): void {
                    if (msg.session !== self._session.getUUID()) {
                        return;
                    }
                    if (self._destroy !== undefined) {
                        return response(
                            new IPC.TimerangeSearchResponse({
                                session: self._session.getUUID(),
                                ranges: [],
                                error: self._logger.warn(
                                    `Cannot procceed command, because session is destroing`,
                                ),
                                id: msg.id,
                            }),
                        );
                    }
                    const stream = self._session.getStream();
                    if (stream instanceof Error) {
                        return response(
                            new IPC.TimerangeSearchResponse({
                                session: self._session.getUUID(),
                                ranges: [],
                                error: self._logger.warn(
                                    `Fail to get regular expression due error: ${stream.message}`,
                                ),
                                id: msg.id,
                            }),
                        );
                    }
                    if (stream.len() === 0) {
                        return response(
                            new IPC.TimerangeSearchResponse({
                                session: self._session.getUUID(),
                                ranges: [],
                                id: msg.id,
                            }),
                        );
                    }
                    const regs = msg.points.map((p) => getSearchRegExp(p.request, p.flags));
                    const errors: Error[] = (regs as any[]).filter((p) => p instanceof Error);
                    if (errors.length !== 0) {
                        const error: Error = new Error(`${errors.map((_) => _.message)}`);
                        return response(
                            new IPC.TimerangeSearchResponse({
                                session: self._session.getUUID(),
                                ranges: [],
                                error: self._logger.warn(
                                    `Fail to get regular expression due error: ${error.message}`,
                                ),
                                id: msg.id,
                            }),
                        );
                    }
                    const measure = self._logger.measure(`searching`);
                    self._search(msg.format, { points: regs, strict: msg.strict })
                        .then((ranges: IRange[]) => {
                            response(
                                new IPC.TimerangeSearchResponse({
                                    session: self._session.getUUID(),
                                    ranges: ranges,
                                    id: msg.id,
                                }),
                            );
                        })
                        .catch((err: Error) => {
                            response(
                                new IPC.TimerangeSearchResponse({
                                    session: self._session.getUUID(),
                                    ranges: [],
                                    error: self._logger.warn(
                                        `Fail to make a search due error: ${err.message}`,
                                    ),
                                    id: msg.id,
                                }),
                            );
                        })
                        .canceled(() => {
                            response(
                                new IPC.TimerangeSearchResponse({
                                    session: self._session.getUUID(),
                                    ranges: [],
                                    id: msg.id,
                                }),
                            );
                        })
                        .finally(() => {
                            measure();
                        });
                },
            },
        };
    }

    private _search(format: string, definitions: IRangeDefinition): CancelablePromise<IRange[]> {
        const search: SessionSearch | Error = this._session.getSearch();
        if (search instanceof Error) {
            throw search;
        }
        return new CancelablePromise((resolve, reject, cancel, oncancel) => {
            const uuid: string = Tools.guid();
            oncancel(() => {
                if (!this._tasks.has(uuid)) {
                    // Task is already done
                    return;
                }
                task.abort();
            });
            const task = search
                .search(
                    definitions.points.map((r) => {
                        return {
                            filter: r.source,
                            flags: {
                                cases: r.flags.includes('i') ? true : false,
                                word: false,
                                reg: true,
                            },
                        };
                    }),
                )
                .then((matches: IResultSearchElement[]) => {
                    resolve(this._getRanges(format, matches, definitions));
                })
                .catch(reject)
                .canceled(cancel)
                .finally(() => {
                    this._tasks.delete(uuid);
                    if (this._destroy !== undefined && this._tasks.size === 0) {
                        this._destroy();
                    }
                });
            this._tasks.set(uuid, task);
        });
    }

    private _getRanges(
        format: string,
        matches: IResultSearchElement[],
        definition: IRangeDefinition,
    ): CommonInterfaces.TimeRanges.IRange[] {
        let pending: number = 0;
        let points: IResultSearchElement[] = [];
        const ranges: CommonInterfaces.TimeRanges.IRange[] = [];
        matches.forEach((match: IResultSearchElement) => {
            const matchIndex: number = match.filters[0];
            if (definition.strict) {
                // Strict mode = ON
                // Pattern should be match completely
                if (matchIndex !== pending) {
                    // Row has match with some other hook in chain -> pattern is broken -> drop
                    pending = matchIndex === 0 ? 1 : 0;
                    points = matchIndex === 0 ? [match] : [];
                } else {
                    points.push(match);
                    pending += 1;
                    if (pending === points.length) {
                        const range: CommonInterfaces.TimeRanges.IRange | Error = this._extract(
                            format,
                            points,
                        );
                        if (range instanceof Error) {
                            this._logger.debug(
                                `Range (${JSON.stringify(points)} would be ignored because: ${
                                    range.message
                                })`,
                            );
                        } else {
                            ranges.push(range);
                        }
                        pending = 0;
                        points = [];
                    }
                }
            } else {
                // Strict mode = OFF
                // Pattern is flexible. Only 1st hook and last hooks are checked to close and open range.
                if (matchIndex === 0) {
                    // First hook
                    points = [match];
                } else if (matchIndex === points.length - 1) {
                    // Last hook
                    points.push(match);
                    const range: CommonInterfaces.TimeRanges.IRange | Error = this._extract(
                        format,
                        points,
                    );
                    if (range instanceof Error) {
                        this._logger.debug(
                            `Range (${JSON.stringify(points)} would be ignored because: ${
                                range.message
                            })`,
                        );
                    } else {
                        ranges.push(range);
                    }
                    points = [];
                } else if (matchIndex !== -1) {
                    // Some hook in a middle
                    points.push(match);
                }
            }
        });
        return ranges;
    }

    private _extract(
        format: string,
        points: IResultSearchElement[],
    ): CommonInterfaces.TimeRanges.IRange | Error {
        const stream: SessionStream | Error = this._session.getStream();
        if (stream instanceof Error) {
            throw stream;
        }
        let error: Error | undefined;
        const range = {
            points: points
                .map((match: IResultSearchElement) => {
                    if (error !== undefined) {
                        return null;
                    }
                    const timestamp: IExtractDTFormatResult | Error = stream.extractTimeformat({
                        input: match.content,
                        format: format,
                    });
                    if (timestamp instanceof Error) {
                        error = new Error(
                            this._logger.warn(
                                `Fail extract timestamp due error: ${timestamp.message}`,
                            ),
                        );
                        return null;
                    }
                    return {
                        position: match.position,
                        timestamp: timestamp instanceof Error ? -1 : timestamp.timestamp,
                        str: match.content,
                    };
                })
                .filter((p) => p !== null) as CommonInterfaces.TimeRanges.IRow[],
        };
        return error !== undefined ? error : range;
    }
}

// Original transformer of results
/*
import { CancelablePromise } from "indexer-neon";
import { CommonInterfaces } from '../../../interfaces/interface.common';
import TimestampExtract from '../../features/timestamp/timestamp.extract';
import Logger from '../../../tools/env.logger';

import * as Toolkit from '../../../tools/index';
import * as Stream from 'stream';

export interface IProgressChunkEvent {
    rows: number;
    bytes: number;
    ranges: CommonInterfaces.TimeRanges.IRange[];
}

export interface IRangeDefinition {
    points: RegExp[];
    strict: boolean;
}

export type TResultCallback = (ranges: CommonInterfaces.TimeRanges.IRange[]) => void;

const CRowNumberRegExp = /\u0002(\d*)\u0002/gi;
const CRowNumberDelimiterRegExp = /\u0002/gi;

export default class Transform extends Stream.Transform {

    public static Events = {
        range: 'range',
    };

    private _logger: Logger;
    private _rest: string = '';
    private _streamId: string;
    private _stopped: boolean = false;
    private _state: {
        rows: number,
        bytes: number,
    } = {
        rows: 0,
        bytes: 0,
    };
    private _format: string;
    private _ranges: CommonInterfaces.TimeRanges.IRange[] = [];
    private _definition: IRangeDefinition;
    private _pending: {
        points: string[],
        index: number,
        tasks: Map<string, CancelablePromise>,
        callback: TResultCallback | undefined,
    } = {
        points: [],
        index: 0,
        tasks: new Map(),
        callback: undefined,
    };

    constructor(options: Stream.TransformOptions,
                streamId: string,
                format: string,
                definition: IRangeDefinition) {
        super(options);
        this._streamId = streamId;
        this._format = format;
        this._definition = definition;
        this._logger = new Logger(`Transform.Map: ${this._streamId}`);
    }

    public _transform(chunk: Buffer | string, encoding: string, callback: Stream.TransformCallback | undefined) {
        // Check state
        if (this._stopped) {
            return;
        }
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
        const found: string[] = output.split(/[\n\r]/gi);
        this._state.rows += found.length;
        this._state.bytes += Buffer.byteLength(output, 'utf8');
        // Call callback
        if (callback !== undefined) {
            callback(undefined, output);
        }
        if (found.length !== 0) {
            // Extract ranges
            this._getRanges(found);
        }
    }

    public lock() {
        this._stopped = true;
        this._pending.tasks.forEach((task: CancelablePromise) => {
            task.abort();
        });
        this._pending.tasks.clear();
    }

    public result(callback: (ranges: CommonInterfaces.TimeRanges.IRange[]) => void) {
        if (this._pending.tasks.size === 0) {
            return callback(this._ranges);
        }
        this._pending.callback = callback;
    }

    private _getRanges(rows: string[]) {
        function getMatchIndex(str: string): number {
            let res: number = -1;
            self._definition.points.forEach((reg: RegExp, index: number) => {
                if (res !== -1) {
                    return;
                }
                res = str.search(reg) !== -1 ? index : -1;
            });
            return res;
        }
        const self = this;
        rows.forEach((row: string) => {
            const matchIndex: number = getMatchIndex(row);
            if (this._definition.strict) {
                // Strict mode = ON
                // Pattern should be match completely
                if (matchIndex !== this._pending.index) {
                    if (matchIndex === -1) {
                        return;
                    }
                    // Row has match with some other hook in chain -> pattern is broken -> drop
                    this._pending.index = matchIndex === 0 ? 1 : 0;
                    this._pending.points = matchIndex === 0 ? [row] : [];
                } else {
                    this._pending.points.push(row);
                    this._pending.index += 1;
                    if (this._pending.index === this._definition.points.length) {
                        this._extract(this._pending.points);
                        this._pending.index = 0;
                        this._pending.points = [];
                    }
                }
            } else {
                // Strict mode = OFF
                // Pattern is flexible. Only 1st hook and last hooks are checked to close and open range.
                if (matchIndex === 0) {
                    // First hook
                    this._pending.points = [row];
                } else if (matchIndex === this._definition.points.length - 1) {
                    // Last hook
                    this._pending.points.push(row);
                    this._extract(this._pending.points);
                    this._pending.points = [];
                } else if (matchIndex !== -1) {
                    // Some hook in a middle
                    this._pending.points.push(row);
                }
            }

        });
        this._done();
    }

    private _extract(points: string[]) {
        const guid: string = Toolkit.guid();
        const extractors: TimestampExtract[] = points.map((str: string) => new TimestampExtract(str, this._format));
        const task: CancelablePromise = new CancelablePromise((resolve, reject) => {
            Promise.all(extractors.map(_ => _.extract({}, true))).then((timestamps: number[]) => {
                const range: CommonInterfaces.TimeRanges.IRange = {
                    points: points.map((str: string, index: number) => {
                        return { position: this._extractRowPosition(str), timestamp: timestamps[index], str: str };
                    }),
                };
                this._ranges.push(range);
                this.emit(Transform.Events.range, range);
            }).catch((err: Error) => {
                this._logger.warn(`Fail to get timerange due error: ${err.message}`);
            }).finally(() => {
                resolve();
            });
        }).canceled(() => {
            extractors.forEach((inst) => inst.abort());
        }).finally(() => {
            this._pending.tasks.delete(guid);
            this._done();
        });
        this._pending.tasks.set(guid, task);
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

    private _extractRowPosition(rowStr: string): number {
        const value: RegExpMatchArray | null = rowStr.match(CRowNumberRegExp);
        if (value === null || value.length !== 1) {
            return -1;
        }
        value[0] = value[0].replace(CRowNumberDelimiterRegExp, '');
        return parseInt(value[0].trim(), 10);
    }

    private _done() {
        if (this._pending.tasks.size === 0 && this._pending.callback !== undefined) {
            this._pending.callback(this._ranges);
            this._pending.callback = undefined;
        }
    }

}

*/
