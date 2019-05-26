import { IPCMessages } from '../services/service.electron.ipc';
import { Observable, Subject, Subscription } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';
import { ControllerSessionTabStreamOutput } from '../controller/controller.session.tab.stream.output';
import { ControllerSessionTabStreamBookmarks, IBookmark } from './controller.session.tab.stream.bookmarks';
import OutputRedirectionsService from '../services/standalone/service.output.redirections';

export type TRequestDataHandler = (start: number, end: number) => Promise<IPCMessages.StreamChunk>;

export type TGetActiveSearchRequestsHandler = () => RegExp[];

export interface IParameters {
    guid: string;
    requestDataHandler: TRequestDataHandler;
    getActiveSearchRequests: TGetActiveSearchRequestsHandler;
    stream: ControllerSessionTabStreamOutput;
}

export interface ISearchStreamPacket {
    str: string | undefined;
    position: number;
    positionInStream: number;
    pluginId: number;
    rank: number;
    sessionId: string;
    bookmarks: ControllerSessionTabStreamBookmarks;
}

export interface IStreamState {
    originalCount: number;
    count: number;
    bookmarkOffset: number;
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
    rows: ISearchStreamPacket[];
}

export const Settings = {
    trigger         : 1000,     // Trigger to load addition chunk
    maxRequestCount : 5000,     // chunk size in rows
    maxStoredCount  : 10000,    // limit of rows to have it in RAM. All above should be removed
    requestDelay    : 250,      // ms, delay before to do request
};

export class ControllerSessionTabSearchOutput {

    private _guid: string;
    private _logger: Toolkit.Logger;
    private _rows: ISearchStreamPacket[] = [];
    private _requestDataHandler: TRequestDataHandler;
    private _getActiveSearchRequests: TGetActiveSearchRequestsHandler;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _stream: ControllerSessionTabStreamOutput;
    private _bookmakrs: ControllerSessionTabStreamBookmarks;
    private _state: IStreamState = {
        count: 0,
        originalCount: 0,
        bookmarkOffset: 0,
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
        onReset: new Subject<void>(),
        onRangeLoaded: new Subject<ILoadedRange>(),
        onBookmarksChanged: new Subject<void>(),
        onScrollTo: new Subject<number>(),
    };

    constructor(params: IParameters) {
        this._guid = params.guid;
        this._stream = params.stream;
        this._bookmakrs = params.stream.getBookmarks();
        this._requestDataHandler = params.requestDataHandler;
        this._getActiveSearchRequests = params.getActiveSearchRequests;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchOutput: ${this._guid}`);
        this._subscriptions.onRowSelected = OutputRedirectionsService.subscribe(this._guid, this._onRowSelected.bind(this));
        this._subscriptions.onAddedBookmark = this._bookmakrs.getObservable().onAdded.subscribe(this._onUpdateBookmarksState.bind(this));
        this._subscriptions.onRemovedBookmark = this._bookmakrs.getObservable().onRemoved.subscribe(this._onUpdateBookmarksState.bind(this));
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
        onBookmarksChanged: Observable<void>,
        onReset: Observable<void>,
        onScrollTo: Observable<number>,
    } {
        return {
            onStateUpdated: this._subjects.onStateUpdated.asObservable(),
            onRangeLoaded: this._subjects.onRangeLoaded.asObservable(),
            onBookmarksChanged: this._subjects.onBookmarksChanged.asObservable(),
            onReset: this._subjects.onReset.asObservable(),
            onScrollTo: this._subjects.onScrollTo.asObservable(),
        };
    }

    public getRange(range: IRange): ISearchStreamPacket[] | Error {
        let rows: ISearchStreamPacket[] = [];
        if (isNaN(range.start) || isNaN(range.end) || !isFinite(range.start) || !isFinite(range.end)) {
            return new Error(`Range has incorrect format. Start and end shound be finite and not NaN`);
        }
        if (this._state.originalCount === 0) {
            if (this._rows.length - 1 < range.end || range.start < 0) {
                return [];
            }
            return this._rows.slice(range.start, range.end + 1);
        }
        const correction = this._normalizeRange(range);
        range = correction.range;
        const stored = Object.assign({}, this._state.stored);
        if (this._state.count === 0 || range.start < 0 || range.end < 0 || stored.start < 0 || stored.end < 0) {
            return [];
        }
        if (stored.start >= 0 && stored.end >= 0) {
            if (range.start >= stored.start && range.end <= stored.end) {
                rows = this._getRowsSliced(range.start, range.end + 1);
            } else if (this._rows.length > 0 && range.end > stored.start && range.start < stored.start && range.end < stored.end) {
                rows = this._getPendingPackets(range.start, stored.start);
                rows.push(...this._getRowsSliced(stored.start, range.end + 1));
            } else if (this._rows.length > 0 && range.start < stored.end && range.start > stored.start && range.end > stored.end) {
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
        if (correction.offset !== 0) {
            const bookmarkedRows: ISearchStreamPacket[] = this._getBookmarkedRowsFromEnd();
            if (bookmarkedRows.length !== 0) {
                if (bookmarkedRows.length >= correction.offset) {
                    rows.push(...bookmarkedRows.slice(0, correction.offset));
                    rows.splice(0, correction.offset);
                } else if (bookmarkedRows.length < correction.offset) {
                    rows.push(...bookmarkedRows);
                    rows.splice(0, bookmarkedRows.length);
                }
            }
        }
        return rows;
    }

    public setFrame(range: IRange) {
        if (this._state.originalCount === 0) {
            return;
        }
        this._state.frame = Object.assign({}, this._normalizeRange(range)).range;
        if (!this._load()) {
            // No need to make request, but check buffer
            this._buffer();
        }
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
            originalCount: 0,
            bookmarkOffset: 0,
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
    public updateStreamState(message: IPCMessages.SearchRequestResults): void {
        // Update count of rows
        this._setBookmarksLengthOffset();
        this._setTotalStreamCount(message.found);
        this._subjects.onStateUpdated.next(Object.assign({}, this._state));
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Rows operations
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _getRowsSliced(from: number, to: number): ISearchStreamPacket[] {
        const offset: number = this._state.stored.start > 0 ? this._state.stored.start : 0;
        return this._rows.slice(from - offset, to - offset);
    }

    private _onRowSelected(sender: string, row: number) {
        if (sender === 'search') {
            return;
        }
        this._subjects.onScrollTo.next(row);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Bookmarks
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _normalizeRange(range: IRange): { range: IRange, offset: number } {
        let offset: number = 0;
        if (range.end > this._state.originalCount - 1) {
            offset = (range.end - this._state.originalCount) + 1;
            range.start -= offset;
            range.end -= offset;
        }
        return { range: range, offset: offset };
    }

    private _getBookmarkedRowsFromEnd(): ISearchStreamPacket[] {
        const last: number = this._getLastPosNotBookmarkedRow().index;
        if (last === -1) {
            return [];
        }
        const extra: number = (this._rows.length - 1) - last;
        return extra === 0 ? [] : this._rows.slice(last + 1, this._rows.length);
    }

    private _onUpdateBookmarksState(bookmark: IBookmark) {
        // Clear from bookmarks
        this._rows = this._removeBookmarks(this._rows);
        // Insert bookmarks if exist
        this._rows = this._insertBookmarks(this._rows);
        // Setup parameters of starage
        this._state.stored.start = this._getFirstPosNotBookmarkedRow().position;
        this._state.stored.end = this._getLastPosNotBookmarkedRow().position;
        // Update offset
        this._setBookmarksLengthOffset();
        // Update count or rows
        this._setTotalStreamCount(this._state.originalCount);
        if (this._state.originalCount === 0) {
            // No rows in output
            this._subjects.onStateUpdated.next(Object.assign({}, this._state));
        }
        // Emit rerequest event
        this._subjects.onBookmarksChanged.next();
    }

    private _setBookmarksLengthOffset() {
        let offset: number = this._bookmakrs.get().size;
        if (offset === 0) {
            this._state.bookmarkOffset = offset;
            return;
        }
        const requests: RegExp[] = this._getActiveSearchRequests();
        if (requests.length === 0) {
            this._state.bookmarkOffset = offset;
            return;
        }
        this._bookmakrs.get().forEach((bookmark: IBookmark) => {
            for (let i = requests.length - 1; i >= 0; i -= 1) {
                if (bookmark.str.search(requests[i]) !== -1) {
                    offset -= 1;
                    break;
                }
            }
        });
        this._state.bookmarkOffset = offset;
    }

    private _insertBookmarks(rows: ISearchStreamPacket[]): ISearchStreamPacket[] {
        const add = (target: ISearchStreamPacket[], from: number, to: number) => {
            const between: number[] = this._getBetween(indexes, from, to);
            between.forEach((index: number) => {
                if (index === from || index === to) {
                    return;
                }
                const inserted: IBookmark = bookmarks.get(index);
                target.push({
                    str: inserted.str,
                    rank: inserted.rank,
                    positionInStream: inserted.position,
                    position: -1,
                    pluginId: inserted.pluginId,
                    sessionId: this._guid,
                    bookmarks: this._bookmakrs,
                });
            });
        };
        const bookmarks: Map<number, IBookmark> = this._bookmakrs.get();
        const indexes: number[] = Array.from(bookmarks.keys());
        if (indexes.length === 0) {
            return rows;
        }
        indexes.sort((a, b) => a - b);
        const updated: ISearchStreamPacket[] = [];
        if (rows.length === 0) {
            add(updated, -1, Infinity);
            return updated;
        }
        rows.forEach((row: ISearchStreamPacket, i: number) => {
            if (i ===  rows.length - 1 && row.position !== this._state.originalCount - 1) {
                updated.push(row);
                return;
            } else if (i ===  rows.length - 1 && row.position === this._state.originalCount - 1) {
                updated.push(row);
                add(updated, row.positionInStream, Infinity);
                return;
            } else if (i === 0 && row.position === 0) {
                add(updated, -1, row.positionInStream);
            }
            updated.push(row);
            add(updated, row.positionInStream, rows[i + 1].positionInStream);
        });
        return updated;
    }

    private _removeBookmarks(rows: ISearchStreamPacket[]): ISearchStreamPacket[] {
        return rows.filter((row: ISearchStreamPacket) => {
            return row.position !== -1;
        });
    }

    private _getFirstPosNotBookmarkedRow(): { position: number, index: number } {
        for (let i = 0, max = this._rows.length - 1; i <= max; i += 1) {
            if (this._rows[i].position !== -1) {
                return { position: this._rows[i].position, index: i };
            }
        }
        return { position: -1, index: -1 };
    }

    private _getLastPosNotBookmarkedRow(): { position: number, index: number } {
        for (let i = this._rows.length - 1; i >= 0; i -= 1) {
            if (this._rows[i].position !== -1) {
                return { position: this._rows[i].position, index: i };
            }
        }
        return { position: -1, index: -1 };
    }

    private _getBetween(indexes: number[], from: number, to: number): number[] {
        return indexes.filter((value: number) => {
            return value >= from ? (value <= to ? true : false) : false;
        });
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
            toEnd: (this._state.originalCount - 1) - frame.end
        };
        if (distance.toStart > (Settings.maxRequestCount / 2)) {
            request.start = distance.toStart - (Settings.maxRequestCount / 2);
        } else {
            request.start = 0;
        }
        if (distance.toEnd > (Settings.maxRequestCount / 2)) {
            request.end = frame.end + (Settings.maxRequestCount / 2);
        } else {
            request.end = (this._state.originalCount - 1);
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
                this._parse(message.data, message.start, message.end);
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
            end: (frame.end + Settings.trigger) > (this._state.originalCount - 1) ? (this._state.originalCount - 1) : (frame.end + Settings.trigger),
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
            request.end = (extended.end + Settings.maxRequestCount) > this._state.originalCount - 1 ? (this._state.originalCount - 1) : (extended.end + Settings.maxRequestCount);
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
            this._parse(message.data, message.start, message.end);
        }).catch((error: Error) => {
            this._logger.error(`Error during requesting data (rows from ${request.start} to ${request.end}): ${error.message}`);
            this._state.bufferLoadingRequestId = undefined;
        });
    }

    /**
     * Add new rows into output.
     * @param { string } input - string with rows data
     * @param { number } from - number of first row in "input"
     * @param { number } to - number of last row in "input"
     * @param { number } count - total count of rows in whole stream (not in input, but in whole stream)
     * @returns void
     */
    private _parse(input: string, from: number, to: number): void {
        const rows: string[] = input.split(/\n/gi);
        // Conver rows to packets
        const packets: ISearchStreamPacket[] = rows.map((str: string, i: number) => {
            return {
                str: this._clearRowStr(str),                        // Get cleared string
                position: from + i,                                // Position in file
                positionInStream: this._extractRowPosition(str),    // Get position in stream
                pluginId: this._extractPluginId(str),               // Get plugin id
                rank: this._stream.getRank(),
                sessionId: this._guid,
                bookmarks: this._bookmakrs,
            };
        }).filter((packet: ISearchStreamPacket) => {
            return (packet.positionInStream !== -1);
        });
        if (packets.length !== (to - from + 1)) {
            throw new Error(`Count of gotten rows dismatch with defined range. Range: ${from}-${to}. Actual count: ${rows.length}; expected count: ${to - from}.`);
        }
        this._acceptPackets(packets);
    }

    private _getPendingPackets(first: number, last: number): ISearchStreamPacket[] {
        const rows: ISearchStreamPacket[] = Array.from({ length: last - first}).map((_, i) => {
            return {
                pluginId: -1,
                position: first + i,
                positionInStream: first + i,
                str: undefined,
                rank: this._stream.getRank(),
                sessionId: this._guid,
                bookmarks: this._bookmakrs,
            };
        });
        return rows;
    }
    /**
     * Adds new packet into stream and updates stream state
     * @param { ISearchStreamPacket[] } packets - new packets to be added into stream
     * @param { number } start - number of first row in packets
     * @param { number } end - number of last row in packetes
     * @returns void
     */
    private _acceptPackets(packets: ISearchStreamPacket[]): void {
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
            this._rows = this._removeBookmarks(this._rows);
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
            this._rows = this._removeBookmarks(this._rows);
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
        // Insert bookmarks if exist
        this._rows = this._insertBookmarks(this._rows);
        // Setup parameters of starage
        this._state.stored.start = this._getFirstPosNotBookmarkedRow().position;
        this._state.stored.end = this._getLastPosNotBookmarkedRow().position;
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
        this._state.originalCount = count;
        this._state.count = this._state.originalCount + this._state.bookmarkOffset;
    }

}
