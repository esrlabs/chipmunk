import { IPCMessages } from '../services/service.electron.ipc';
import { Observable, Subject, Subscription } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';
import { ControllerSessionTabStreamOutput } from '../controller/controller.session.tab.stream.output';
import { ControllerSessionTabStreamBookmarks, IBookmark } from './controller.session.tab.stream.bookmarks';
import { ControllerSessionTabSourcesState } from './controller.session.tab.sources.state';
import { ControllerSessionScope } from './controller.session.tab.scope';
import OutputRedirectionsService from '../services/standalone/service.output.redirections';

export type TRequestDataHandler = (start: number, end: number) => Promise<IPCMessages.StreamChunk>;

export type TGetActiveSearchRequestsHandler = () => RegExp[];

export interface IParameters {
    guid: string;
    requestDataHandler: TRequestDataHandler;
    getActiveSearchRequests: TGetActiveSearchRequestsHandler;
    stream: ControllerSessionTabStreamOutput;
    scope: ControllerSessionScope;
}

export interface ISearchStreamPacket {
    str: string | undefined;
    position: number;
    positionInStream: number;
    pluginId: number;
    rank: number;
    sessionId: string;
    scope: ControllerSessionScope;
    controller: ControllerSessionTabStreamOutput;
    bookmarks: ControllerSessionTabStreamBookmarks;
    sources: ControllerSessionTabSourcesState;
    parent: string;
}

export interface IStreamState {
    originalCount: number;
    count: number;
    bookmarksCount: number;
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
    maxRequestCount : 2000,     // chunk size in rows
    maxStoredCount  : 2000,     // limit of rows to have it in RAM. All above should be removed
    requestDelay    : 0,        // ms, delay before to do request
};

export class ControllerSessionTabSearchOutput {

    private _guid: string;
    private _logger: Toolkit.Logger;
    private _rows: ISearchStreamPacket[] = [];
    private _requestDataHandler: TRequestDataHandler;
    private _getActiveSearchRequests: TGetActiveSearchRequestsHandler;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _stream: ControllerSessionTabStreamOutput;
    private _scope: ControllerSessionScope;
    private _preloadTimestamp: number = -1;
    private _bookmakrs: ControllerSessionTabStreamBookmarks;
    private _sources: ControllerSessionTabSourcesState;
    private _lastRequestedRows: ISearchStreamPacket[] = [];
    private _state: IStreamState = {
        count: 0,
        originalCount: 0,
        bookmarksCount: 0,
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
        this._sources = new ControllerSessionTabSourcesState(this._guid);
        this._requestDataHandler = params.requestDataHandler;
        this._getActiveSearchRequests = params.getActiveSearchRequests;
        this._scope = params.scope;
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

    public getFrame(): IRange {
        return {
            start: this._state.frame.start >= 0 ? this._state.frame.start : 0,
            end: this._state.frame.end >= 0 ? this._state.frame.end : 0,
        };
    }

    public getRange(range: IRange): ISearchStreamPacket[] | Error {
        let rows: ISearchStreamPacket[] = [];
        if (isNaN(range.start) || isNaN(range.end) || !isFinite(range.start) || !isFinite(range.end)) {
            return new Error(`Range has incorrect format. Start and end shound be finite and not NaN`);
        }
        if (range.start < 0 || range.end < 0) {
            return [];
        }
        if (this._state.count === 0) {
            return [];
        }
        const offset: number = this._state.stored.start < 0 ? 0 : this._state.stored.start;
        const indexes = {
            start: range.start - offset,
            end: range.end - offset,
        };
        const stored = Object.assign({}, this._state.stored);
        if (indexes.start > this._rows.length - 1) {
            rows = this._getPendingPackets(range.start, range.end + 1);
        } else if (indexes.start < 0 && indexes.end < 0) {
            rows = this._getPendingPackets(range.start, range.end + 1);
        } else if (indexes.start >= 0 && indexes.start <= this._rows.length - 1 && indexes.end <= this._rows.length - 1) {
            rows = this._rows.slice(indexes.start, indexes.end + 1);
        } else if (indexes.start >= 0 && indexes.start <= this._rows.length - 1 && indexes.end > this._rows.length - 1) {
            rows = this._rows.slice(indexes.start, this._rows.length);
            rows.push(...this._getPendingPackets(this._rows.length, indexes.end + 1));
        } else if (indexes.start < 0 && indexes.end >= 0  && indexes.end <= this._rows.length - 1) {
            rows = this._rows.slice(0, indexes.end + 1);
            rows.unshift(...this._getPendingPackets(0, Math.abs(indexes.start)));
        }
        // Check if state is still same
        if (stored.start !== this._state.stored.start || stored.end !== this._state.stored.end) {
            return new Error(this._logger.warn(`State was changed. Was { start: ${stored.start}, end: ${stored.end}}, became { start: ${this._state.stored.start}, end: ${this._state.stored.end}}.`));
        }
        // Confirm: range is fount correctly
        if (rows.length !== range.end - range.start + 1) {
            return new Error(this._logger.error(`Calculation error: gotten ${rows.length} rows; should be: ${range.end - range.start}. State was { start: ${stored.start}, end: ${stored.end}}, became { start: ${this._state.stored.start}, end: ${this._state.stored.end}}.`));
        }
        this.setFrame(range);
        return rows;
    }

    public setFrame(range: IRange) {
        if (this._state.originalCount === 0 || this._state.count === 0) {
            return;
        }
        // Normalize range (to exclude bookmarks)
        range.end = range.end > this._state.originalCount - 1 ? this._state.originalCount - 1 : range.end;
        this._state.frame = Object.assign({}, range);
        if (!this._load()) {
            // No need to make request, but check buffer
            // this._buffer();
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
            bookmarksCount: 0,
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
    public updateStreamState(rowsCount: number): void {
        // Update count of rows
        this._setTotalStreamCount(rowsCount);
        // Update bookmarks state
        this._updateBookmarksData();
        // Trigger events
        this._subjects.onStateUpdated.next(Object.assign({}, this._state));
    }

    public getRowsCount(): number {
        return this._state.count;
    }

    public preload(range: IRange): Promise<IRange> {
        // Normalize range (to exclude bookmarks)
        range.end = range.end > this._state.originalCount - 1 ? this._state.originalCount - 1 : range.end;
        return this._preload(range);
    }

    public getRowByPosition(position: number): ISearchStreamPacket | undefined {
        return this._rows.find((row: ISearchStreamPacket) => {
            return row.positionInStream === position;
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Rows operations
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _isRangeStored(range: IRange): boolean {
        const stored = Object.assign({}, this._state.stored);
        if (this._state.count === 0 || range.start < 0 || range.end < 0) {
            return true;
        }
        if (range.start >= stored.start && range.end <= stored.end) {
            return true;
        }
        return false;
    }

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
    private _onUpdateBookmarksState(bookmark: IBookmark) {
        this._updateBookmarksData(bookmark);
    }

    private _updateBookmarksData(bookmark?: IBookmark) {
        // Clear from bookmarks
        this._rows = this._removeBookmarks(this._rows);
        // Insert bookmarks if exist
        this._rows = this._insertBookmarks(this._rows);
        // Setup parameters of storage
        this._state.stored.start = this._getFirstPosNotBookmarkedRow().position;
        this._state.stored.end = this._getLastPosNotBookmarkedRow().position;
        // Remember previous value of count
        const count: number = this._state.count;
        // Update count or rows
        this._setTotalStreamCount(this._state.originalCount);
        if (this._state.count !== count) {
            // Emit updating of state event
            this._subjects.onStateUpdated.next(Object.assign({}, this._state));
        }
        if (bookmark !== undefined) {
            // Emit rerequest event
            this._subjects.onBookmarksChanged.next();
        }
    }

    private _insertBookmarks(rows: ISearchStreamPacket[]): ISearchStreamPacket[] {
        const bookmarks: Map<number, IBookmark> = this._bookmakrs.get();
        const indexes: number[] = Array.from(bookmarks.keys());
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
                    sources: this._sources,
                    parent: 'search',
                    scope: this._scope,
                    controller: this._stream
                });
                this._state.bookmarksCount += 1;
            });
        };
        this._state.bookmarksCount = 0;
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
                if (i === 0 && row.position === 0) {
                    add(updated, -1, row.positionInStream);
                }
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
        this._state.bookmarksCount = 0;
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
        const frame = Object.assign({}, this._state.frame);
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
                    this._lastRequestedRows = [];
                    this._parse(message.data, message.start, message.end, this._lastRequestedRows, frame);
                    return;
                }
                // Update size of whole stream (real size - count of rows in stream file)
                this._setTotalStreamCount(message.rows);
                // Parse and accept rows
                this._parse(message.data, message.start, message.end);
                // Check again last requested frame
                if (stored.start <= frame.start && stored.end >= frame.end) {
                    // Update bookmarks state
                    this._updateBookmarksData();
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

    private _preload(range: IRange): Promise<IRange | null> {
        return new Promise((resolve, reject) => {
            const timestamp: number = Date.now();
            if (this._preloadTimestamp !== -1 && timestamp - this._preloadTimestamp < 500) {
                return resolve(null);
            }
            if (this._isRangeStored(range)) {
                this._preloadTimestamp = -1;
                return resolve(range);
            }
            this._preloadTimestamp = timestamp;
            this._requestDataHandler(range.start, range.end).then((message: IPCMessages.StreamChunk) => {
                // Drop request ID
                this._preloadTimestamp = -1;
                // Update size of whole stream (real size - count of rows in stream file)
                this._setTotalStreamCount(message.rows);
                // Parse and accept rows
                this._parse(message.data, message.start, message.end);
                // Update bookmarks state
                this._updateBookmarksData();
                // Return actual preloaded range
                resolve({ start: message.start, end: message.end});
            }).catch((error: Error) => {
                // Drop request ID
                this._preloadTimestamp = -1;
                // Reject
                reject(new Error(this._logger.error(`Fail to preload data (rows from ${range.start} to ${range.end}) due error: ${error.message}`)));
            });
        });
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
            // Update bookmarks state
            this._updateBookmarksData();
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
    private _parse(input: string, from: number, to: number, dest?: ISearchStreamPacket[], frame?: IRange): void {
        const rows: string[] = input.split(/\n/gi);
        let packets: ISearchStreamPacket[] = [];
        // Conver rows to packets
        try {
            rows.forEach((str: string, i: number) => {
                if (frame !== undefined) {
                    // Frame is defined. We do not need to parse all, just range in frame
                    if (frame.end < from + i) {
                        throw new Error('No need to parse');
                    }
                    if (frame.start > from + i) {
                        return;
                    }
                }
                const position: number = this._extractRowPosition(str); // Get position
                const pluginId: number = this._extractPluginId(str);    // Get plugin id
                packets.push({
                    str: this._clearRowStr(str),
                    position: from + i,
                    positionInStream: position,
                    pluginId: pluginId,
                    rank: this._stream.getRank(),
                    sessionId: this._guid,
                    bookmarks: this._bookmakrs,
                    sources: this._sources,
                    parent: 'search',
                    scope: this._scope,
                    controller: this._stream
                });
            });
        } catch (e) {
            // do nothing
        }
        packets = packets.filter((packet: ISearchStreamPacket) => {
            return (packet.positionInStream !== -1);
        });
        if (dest !== undefined) {
            // Destination storage is defined: we don't need to store rows (accept it)
            dest.push(...packets);
        } else {
            if (packets.length !== (to - from + 1)) {
                throw new Error(`Count of gotten rows dismatch with defined range. Range: ${from}-${to}. Actual count: ${rows.length}; expected count: ${to - from}.`);
            }
            this._acceptPackets(packets);
        }
    }

    private _getPendingPackets(first: number, last: number): ISearchStreamPacket[] {
        const rows: ISearchStreamPacket[] = Array.from({ length: last - first}).map((_, i) => {
            return {
                pluginId: this._lastRequestedRows[i] === undefined ? -1 : this._lastRequestedRows[i].pluginId,
                position: first + i,
                positionInStream: first + i,
                str: this._lastRequestedRows[i] === undefined ? undefined : this._lastRequestedRows[i].str,
                rank: this._stream.getRank(),
                sessionId: this._guid,
                bookmarks: this._bookmakrs,
                sources: this._sources,
                parent: 'search',
                scope: this._scope,
                controller: this._stream
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
        this._state.count = this._state.originalCount + this._state.bookmarksCount;
        if (this._state.count === 0) {
            return this.clearStream();
        }
    }

}
