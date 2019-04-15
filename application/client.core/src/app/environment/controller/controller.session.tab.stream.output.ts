import { IPCMessages } from '../services/service.electron.ipc';
import { Observable, Subject } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';
import OutputRedirectionsService from '../services/standalone/service.output.redirections';

export type TRequestDataHandler = (start: number, end: number) => Promise<IPCMessages.StreamChunk>;

export interface IStreamPacket {
    str: string | undefined;
    position: number;
    pluginId: number;
    rank: number;
    sessionId: string;
}

export interface IStreamState {
    count: number;
    countRank: number;
    stored: IRange;
    frame: IRange;
    lastLoadingRequestId: any;
    bufferLoadingRequestId: any;
}

export interface IRange {
    start: number;
    end: number;
}

export interface ILoadedRange {
    range: IRange;
    rows: IStreamPacket[];
}
/*
export const Settings = {
    trigger         : 10000,    // Trigger to load addition chunk
    maxRequestCount : 50000,    // chunk size in rows
    maxStoredCount  : 100000,   // limit of rows to have it in RAM. All above should be removed
    requestDelay    : 250,      // ms, delay before to do request
};

*/
export const Settings = {
    trigger         : 1000,     // Trigger to load addition chunk
    maxRequestCount : 5000,     // chunk size in rows
    maxStoredCount  : 10000,    // limit of rows to have it in RAM. All above should be removed
    requestDelay    : 250,      // ms, delay before to do request
};

export class ControllerSessionTabStreamOutput {

    private _guid: string;
    private _logger: Toolkit.Logger;
    private _rows: IStreamPacket[] = [];
    private _requestDataHandler: TRequestDataHandler;
    private _subscriptions: { [key: string]: Toolkit.Subscription } = {};
    private _state: IStreamState = {
        count: 0,
        countRank: 1,
        stored: {
            start: -1,
            end: -1,
        },
        frame: {
            start: -1,
            end: -1
        },
        lastLoadingRequestId: undefined,
        bufferLoadingRequestId: undefined,
    };

    private _subjects = {
        onStateUpdated: new Subject<IStreamState>(),
        onRangeLoaded: new Subject<ILoadedRange>(),
        onReset: new Subject<void>(),
        onScrollTo: new Subject<number>(),
    };

    constructor(guid: string, requestDataHandler: TRequestDataHandler) {
        this._guid = guid;
        this._requestDataHandler = requestDataHandler;
        this._logger = new Toolkit.Logger(`ControllerSessionTabStreamOutput: ${this._guid}`);
        this._subscriptions.onRowSelected = OutputRedirectionsService.subscribe(this._guid, this._onRowSelected.bind(this));
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * API of controller
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

     /**
     * List of available observables.
     * @returns { onStateUpdated: Observable<IStreamState>, onRangeLoaded: Observable<ILoadedRange>, }
     */
    public getObservable(): {
        onStateUpdated: Observable<IStreamState>,
        onRangeLoaded: Observable<ILoadedRange>,
        onReset: Observable<void>,
        onScrollTo: Observable<number>,
    } {
        return {
            onStateUpdated: this._subjects.onStateUpdated.asObservable(),
            onRangeLoaded: this._subjects.onRangeLoaded.asObservable(),
            onReset: this._subjects.onReset.asObservable(),
            onScrollTo: this._subjects.onScrollTo.asObservable(),
        };
    }

    public getRange(range: IRange): IStreamPacket[] | Error {
        let rows: IStreamPacket[] = [];
        const stored = Object.assign({}, this._state.stored);
        if (this._state.count === 0 || range.start < 0 || range.end < 0) {
            return [];
        }
        if (stored.start >= 0 && stored.end >= 0) {
            if (range.start >= stored.start && range.end <= stored.end) {
                rows = this._getRowsSliced(range.start, range.end + 1);
            } else if (range.end > stored.start && range.start < stored.start && range.end < stored.end) {
                rows = this._getPendingPackets(range.start, stored.start);
                rows.push(...this._getRowsSliced(stored.start, range.end + 1));
            } else if (range.start < stored.end && range.start > stored.start && range.end > stored.end) {
                rows = this._getPendingPackets(stored.end + 1, range.end + 1);
                rows.unshift(...this._getRowsSliced(range.start, stored.end + 1));
            } else {
                rows = this._getPendingPackets(range.start, range.end + 1);
            }
        } else {
            rows = this._getPendingPackets(range.start, range.end + 1);
        }
        // Check if state is still same
        if (stored.start !== this._state.stored.start || stored.end !== this._state.stored.end) {
            return new Error(this._logger.warn(`State was changed. Was { start: ${stored.start}, end: ${stored.end}}, became { start: ${this._state.stored.start}, end: ${this._state.stored.end}}.`));
        }
        // Confirm: range is fount correctly
        if (rows.length !== range.end - range.start + 1) {
            return new Error(this._logger.error(`Calculation error: gotten ${rows.length} rows; should be: ${range.end - range.start}. State was { start: ${stored.start}, end: ${stored.end}}, became { start: ${this._state.stored.start}, end: ${this._state.stored.end}}.`));
        }
        this._state.frame = Object.assign({}, range);
        return rows;
    }

    public setFrame(range: IRange) {
        this._state.frame = Object.assign({}, range);
        if (!this._load()) {
            // No need to make request, but check buffer
            this._buffer();
        }
    }

    public getRank(): number {
        return this._state.countRank;
    }

    /**
     * Returns total count of rows in whole stream
     * @returns number
     */
    public getState(): IStreamState {
        return Object.assign({}, this._state);
    }

    /**
     * Cleans whole stream
     * @returns void
     */
    public clearStream(): void {
        this._rows = [];
        this._state = {
            count: 0,
            countRank: 1,
            stored: {
                start: -1,
                end: -1,
            },
            frame: {
                start: -1,
                end: -1
            },
            lastLoadingRequestId: undefined,
            bufferLoadingRequestId: undefined,
        };
        this._subjects.onReset.next();
    }

    /**
     * Update length of stream and returns needed range of rows to fit maximum buffer (considering current cursor position).
     * @param { number } rows - number or rows in stream
     * @returns { IRange | undefined } returns undefined if no need to load rows
     */
    public updateStreamState(message: IPCMessages.StreamUpdated): void {
        // Update count of rows
        this._setTotalStreamCount(message.rowsCount);
        // Check: shell we add data right now or not
        if (this._state.frame.end + 1 === message.addedFrom) {
            // Update size of whole stream (real size - count of rows in stream file)
            this._setTotalStreamCount(message.rowsCount);
            // Frame at the end of stream. Makes sense to store data
            this._parse(message.addedRowsData);
        }
        this._subjects.onStateUpdated.next(Object.assign({}, this._state));
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Rows operations
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _getRowsSliced(from: number, to: number): IStreamPacket[] {
        const offset: number = this._state.stored.start > 0 ? this._state.stored.start : 0;
        return this._rows.slice(from - offset, to - offset);
    }

    private _onRowSelected(sender: string, row: number) {
        if (sender === 'stream') {
            return;
        }
        this._subjects.onScrollTo.next(row);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Internal methods / helpers
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _load(): boolean {
        // First step: drop previos request
        clearTimeout(this._state.lastLoadingRequestId);
        // Check: do we need to load something at all
        const frame = this._state.frame;
        const stored = this._state.stored;
        if (stored.start <= frame.start && stored.end >= frame.end) {
            // Frame in borders of stored data. No need to request
            return false;
        }
        const request: IRange = { start: -1, end: -1 };
        // Calculate data, which should be requested
        if (frame.end - frame.start + 1 <= 0) {
            return false;
        }
        const distance = {
            toStart: frame.start,
            toEnd: (this._state.count - 1) - frame.end
        };
        if (distance.toStart > (Settings.maxRequestCount / 2)) {
            request.start = distance.toStart - (Settings.maxRequestCount / 2);
        } else {
            request.start = 0;
        }
        if (distance.toEnd > (Settings.maxRequestCount / 2)) {
            request.end = frame.end + (Settings.maxRequestCount / 2);
        } else {
            request.end = (this._state.count - 1);
        }
        this._state.lastLoadingRequestId = setTimeout(() => {
            this._state.lastLoadingRequestId = undefined;
            this._requestDataHandler(request.start, request.end).then((message: IPCMessages.StreamChunk) => {
                // Check: do we already have other request
                if (this._state.lastLoadingRequestId !== undefined) {
                    // No need to parse - new request was created
                    return;
                }
                // Update size of whole stream (real size - count of rows in stream file)
                this._setTotalStreamCount(message.rows);
                // Parse and accept rows
                this._parse(message.data);
                // Check again last requested frame
                if (stored.start <= frame.start && stored.end >= frame.end) {
                    // Send notification about update
                    this._subjects.onRangeLoaded.next({
                        range: { start: frame.start, end: frame.end },
                        rows: this._getRowsSliced(frame.start, frame.end + 1)
                    });
                    return;
                } else {
                    this._logger.warn(`Requested frame isn't in scope of stored data. Request - rows from ${request.start} to ${request.end}.`);
                }
            }).catch((error: Error) => {
                this._logger.error(`Error during requesting data (rows from ${request.start} to ${request.end}): ${error.message}`);
            });
        }, Settings.requestDelay);
        return true;
    }

    private _buffer() {
        if (this._state.bufferLoadingRequestId !== undefined) {
            // Buffer is already requested
            return;
        }
        const frame = this._state.frame;
        const stored = this._state.stored;
        const extended = {
            start: (frame.start - Settings.trigger) < 0 ? 0 : (frame.start - Settings.trigger),
            end: (frame.end + Settings.trigger) > (this._state.count - 1) ? (this._state.count - 1) : (frame.end + Settings.trigger),
        };
        const diffs = {
            fromEnd: (extended.end > stored.end) ? (extended.end - stored.end) : -1,
            fromStart: (extended.start < stored.start) ? (stored.start - extended.start) : -1,
        };
        if (diffs.fromEnd === -1 && diffs.fromStart === -1) {
            // No need to add buffer
            return;
        }
        const request = {
            start: -1,
            end: -1,
        };
        if (diffs.fromStart > diffs.fromEnd) {
            // Add buffer to the beggining
            request.start = (extended.start - Settings.maxRequestCount) < 0 ? 0 : (extended.start - Settings.maxRequestCount);
            request.end = stored.start;
        } else {
            // Add buffer to the end
            request.start = stored.end;
            request.end = (extended.end + Settings.maxRequestCount) > this._state.count - 1 ? (this._state.count - 1) : (extended.end + Settings.maxRequestCount);
        }
        this._state.bufferLoadingRequestId = this._requestDataHandler(request.start, request.end).then((message: IPCMessages.StreamChunk) => {
            this._state.bufferLoadingRequestId = undefined;
            // Check: do we already have other request
            if (this._state.lastLoadingRequestId !== undefined) {
                // No need to parse - new request was created
                return;
            }
            // Update size of whole stream (real size - count of rows in stream file)
            this._setTotalStreamCount(message.rows);
            // Parse and accept rows
            this._parse(message.data);
        }).catch((error: Error) => {
            this._logger.error(`Error during requesting data (rows from ${request.start} to ${request.end}): ${error.message}`);
            this._state.bufferLoadingRequestId = undefined;
        });
    }

    /**
     * Add new rows into output.
     * @param { string } input - string with rows data
     * @param { number } start - number of first row in "input"
     * @param { number } end - number of last row in "input"
     * @param { number } count - total count of rows in whole stream (not in input, but in whole stream)
     * @returns void
     */
    private _parse(input: string): void {
        // TODO: filter here should be removed -> bad data comes from process, it should be resolved there
        const rows: string[] = input.split(/\n/gi);
        // Conver rows to packets
        const packets: IStreamPacket[] = rows.map((str: string) => {
            return {
                str: this._clearRowStr(str),                // Get cleared string
                position: this._extractRowPosition(str),    // Get position
                pluginId: this._extractPluginId(str),       // Get plugin id
                rank: this._state.countRank,
                sessionId: this._guid,
            };
        }).filter((packet: IStreamPacket) => {
            return (packet.position !== -1);
        });
        this._acceptPackets(packets);
    }

    private _getPendingPackets(first: number, last: number): IStreamPacket[] {
        const rows: IStreamPacket[] = Array.from({ length: last - first}).map((_, i) => {
            return {
                pluginId: -1,
                position: first + i,
                str: undefined,
                rank: this._state.countRank,
                sessionId: this._guid,
            };
        });
        return rows;
    }
    /**
     * Adds new packet into stream and updates stream state
     * @param { IStreamPacket[] } packets - new packets to be added into stream
     * @param { number } start - number of first row in packets
     * @param { number } end - number of last row in packetes
     * @returns void
     */
    private _acceptPackets(packets: IStreamPacket[]): void {
        if (packets.length === 0) {
            return;
        }
        const packet: IRange = { start: packets[0].position, end: packets[packets.length - 1].position};
        if (this._rows.length === 0) {
            this._rows.push(...packets);
        } else if (packet.start > this._state.stored.end) {
            this._rows = packets;
        } else if (packet.end < this._state.stored.start) {
            this._rows = packets;
        } else if (packet.start < this._state.stored.start) {
            const range = this._state.stored.start - packet.start;
            const injection = packets.slice(0, range);
            this._rows.unshift(...injection);
            // Check size
            if (this._rows.length > Settings.maxStoredCount) {
                const toCrop: number = this._rows.length - Settings.maxStoredCount;
                // Remove from the end
                this._rows.splice(-toCrop, toCrop);
            }
        } else if (packet.end > this._state.stored.end) {
            const range = packet.end - this._state.stored.end;
            const injection = packets.slice(packets.length - range, packets.length);
            this._rows.push(...injection);
            // Check size
            if (this._rows.length > Settings.maxStoredCount) {
                const toCrop: number = this._rows.length - Settings.maxStoredCount;
                // Remove from the begin
                this._rows.splice(0, toCrop);
            }
        }
        this._state.stored.start = this._rows[0].position;
        this._state.stored.end = this._rows[this._rows.length - 1].position;
    }

    /**
     * Extracts row number in stream
     * @param { string } rowStr - row string data
     * @returns number
     */
    private _extractRowPosition(rowStr: string): number {
        const value: RegExpMatchArray | null = rowStr.match(/\u0002(\d*)\u0002/gi);
        if (value === null || value.length !== 1) {
            return -1;
        }
        return parseInt(value[0].substring(1, value[0].length - 1), 10);
    }

    /**
     * Extracts from row string data plugin ID (id of data source)
     * @param { string } rowStr - row string data
     * @returns number
     */
    private _extractPluginId(rowStr: string): number {
        const value: RegExpMatchArray | null = rowStr.match(/\u0003(\d*)\u0003/gi);
        if (value === null || value.length !== 1) {
            return -1;
        }
        return parseInt(value[0].substring(1, value[0].length - 1), 10);
    }

    /**
     * Remove from row's string all markers (marker of plugin, marker of row's number)
     * Returns cleared row's string.
     * @param { string } rowStr - row string data
     * @returns string
     */
    private _clearRowStr(rowStr: string): string {
        return rowStr.replace(/\u0002(\d*)\u0002/gi, '').replace(/\u0003(\d*)\u0003/gi, '');
    }

    private _setTotalStreamCount(count: number) {
        this._state.count = count;
        this._state.countRank = count.toString().length;
    }

}
