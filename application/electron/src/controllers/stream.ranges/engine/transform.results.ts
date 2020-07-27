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
