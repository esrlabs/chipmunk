import ServiceElectronIpc, { IPC } from '../../../../../../services/service.electron.ipc';
import { Observable, Subject, Subscription } from 'rxjs';
import { ControllerSessionTabStreamOutput } from '../../../output/controller.session.tab.stream.output';
import { IBookmark } from '../../../bookmarks/controller.session.tab.stream.bookmarks';
import { ControllerSessionTabTimestamp } from '../../../timestamps/session.dependency.timestamps';
import { ControllerSessionScope } from '../../../scope/controller.session.tab.scope';
import {
    extractPluginId,
    extractRowPosition,
    clearRowStr,
} from '../../../../../helpers/row.helpers';
import {
    EKey,
    EParent,
    ISelectionAccessor,
} from '../../../../../../services/standalone/service.output.redirections';
import { IRow } from '../../../row/controller.row.api';
import { Dependency, SessionGetter, SearchSessionGetter } from '../search.dependency';
import { IHotkeyEvent } from '../../../../../../services/service.hotkeys';

import OutputRedirectionsService from '../../../../../../services/standalone/service.output.redirections';
import HotkeysService from '../../../../../../services/service.hotkeys';

import * as Toolkit from 'chipmunk.client.toolkit';

export type TRequestDataHandler = (start: number, end: number) => Promise<IPC.StreamChunk>;

export interface IParameters {
    guid: string;
    requestDataHandler: TRequestDataHandler;
    stream: ControllerSessionTabStreamOutput;
    timestamp: ControllerSessionTabTimestamp;
    scope: ControllerSessionScope;
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

export interface IStreamStateEvent {
    isBookmarkInjection: boolean;
    state: IStreamState;
}

export interface IRange {
    start: number;
    end: number;
}

export interface ILoadedRange {
    range: IRange;
    rows: IRow[];
}

export const Settings = {
    trigger: 1000, // Trigger to load addition chunk
    maxRequestCount: 2000, // chunk size in rows
    maxStoredCount: 2000, // limit of rows to have it in RAM. All above should be removed
    requestDelay: 0, // ms, delay before to do request
};

export class ControllerSessionTabSearchOutput implements Dependency {
    private _uuid: string;
    private _logger: Toolkit.Logger;
    private _rows: IRow[] = [];
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _preloadTimestamp: number = -1;
    private _lastRequestedRows: IRow[] = [];
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
            end: -1,
        },
        lastLoadingRequestId: undefined,
        bufferLoadingRequestId: undefined,
    };

    private _subjects = {
        onStateUpdated: new Subject<IStreamStateEvent>(),
        onReset: new Subject<void>(),
        onRangeLoaded: new Subject<ILoadedRange>(),
        onBookmarksChanged: new Subject<void>(),
        onScrollTo: new Subject<number>(),
    };
    private _accessor: {
        session: SessionGetter;
        search: SearchSessionGetter;
    };

    constructor(uuid: string, session: SessionGetter, search: SearchSessionGetter) {
        this._uuid = uuid;
        this._accessor = {
            session,
            search,
        };
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchOutput: ${this._uuid}`);
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscriptions.onRowSelected = OutputRedirectionsService.subscribe(
                this._uuid,
                this._onRowSelected.bind(this),
            );
            this._subscriptions.onAddedBookmark = this._accessor
                .session()
                .getBookmarks()
                .getObservable()
                .onAdded.subscribe(this._onAddedBookmarksState.bind(this));
            this._subscriptions.onRemovedBookmark = this._accessor
                .session()
                .getBookmarks()
                .getObservable()
                .onRemoved.subscribe(this._onRemovedBookmarksState.bind(this));
            this._subscriptions.selectAllSearchResult =
                HotkeysService.getObservable().selectAllSearchResult.subscribe(
                    this._onSelectAllSearchResult.bind(this),
                );
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ControllerSessionTabSearchOutput';
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * API of controller
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    /**
     * List of available observables.
     * @returns { onStateUpdated: Observable<IStreamStateEvent>, onRangeLoaded: Observable<ILoadedRange>, }
     */
    public getObservable(): {
        onStateUpdated: Observable<IStreamStateEvent>;
        onRangeLoaded: Observable<ILoadedRange>;
        onBookmarksChanged: Observable<void>;
        onReset: Observable<void>;
        onScrollTo: Observable<number>;
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

    public getRange(range: IRange): IRow[] | Error {
        let rows: IRow[] = [];
        if (
            isNaN(range.start) ||
            isNaN(range.end) ||
            !isFinite(range.start) ||
            !isFinite(range.end)
        ) {
            return new Error(
                `Range has incorrect format. Start and end shound be finite and not NaN`,
            );
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
        } else if (
            indexes.start >= 0 &&
            indexes.start <= this._rows.length - 1 &&
            indexes.end <= this._rows.length - 1
        ) {
            rows = this._rows.slice(indexes.start, indexes.end + 1);
        } else if (
            indexes.start >= 0 &&
            indexes.start <= this._rows.length - 1 &&
            indexes.end > this._rows.length - 1
        ) {
            rows = this._rows.slice(indexes.start, this._rows.length);
            rows.push(...this._getPendingPackets(this._rows.length, indexes.end + 1));
        } else if (indexes.start < 0 && indexes.end >= 0 && indexes.end <= this._rows.length - 1) {
            rows = this._rows.slice(0, indexes.end + 1);
            rows.unshift(...this._getPendingPackets(0, Math.abs(indexes.start)));
        }
        // Check if state is still same
        if (stored.start !== this._state.stored.start || stored.end !== this._state.stored.end) {
            return new Error(
                this._logger.warn(
                    `State was changed. Was { start: ${stored.start}, end: ${stored.end}}, became { start: ${this._state.stored.start}, end: ${this._state.stored.end}}.`,
                ),
            );
        }
        // Confirm: range is fount correctly
        if (rows.length !== range.end - range.start + 1) {
            return new Error(
                this._logger.error(
                    `Calculation error: gotten ${rows.length} rows; should be: ${
                        range.end - range.start + 1
                    }. State was { start: ${stored.start}, end: ${stored.end}}, became { start: ${
                        this._state.stored.start
                    }, end: ${this._state.stored.end}}.`,
                ),
            );
        }
        this.setFrame(range);
        return rows;
    }

    public loadRange(range: IRange): Promise<IRow[]> {
        return new Promise((resolve, reject) => {
            if (
                isNaN(range.start) ||
                isNaN(range.end) ||
                !isFinite(range.start) ||
                !isFinite(range.end)
            ) {
                return reject(
                    new Error(
                        `Range has incorrect format. Start and end shound be finite and not NaN`,
                    ),
                );
            }
            this._requestData(range.start, range.end)
                .then((message: IPC.IValidSearchChunk) => {
                    if (message.data === undefined) {
                        return resolve([]);
                    }
                    const packets: IRow[] = [];
                    this._parse(message.data, message.start, message.end, packets);
                    resolve(
                        packets.filter((packet: IRow) => {
                            return packet.position >= range.start && packet.position <= range.end;
                        }),
                    );
                })
                .catch((error: Error) => {
                    reject(
                        new Error(
                            `Error during requesting data (rows from ${range.start} to ${range.end}): ${error.message}`,
                        ),
                    );
                });
        });
    }

    public setFrame(range: IRange) {
        if (this._state.originalCount === 0 || this._state.count === 0) {
            return;
        }
        // Normalize range (to exclude bookmarks)
        range.end =
            range.end > this._state.originalCount - 1 ? this._state.originalCount - 1 : range.end;
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
                end: -1,
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
        if (rowsCount === 0) {
            // Drop
            this.clearStream();
        }
        // Update count of rows
        this._setTotalStreamCount(rowsCount);
        // Update bookmarks state
        this._updateBookmarksData();
        // Trigger events
        this._subjects.onStateUpdated.next({
            isBookmarkInjection: false,
            state: Object.assign({}, this._state),
        });
    }

    public getRowsCount(): number {
        return this._state.count;
    }

    public preload(range: IRange): Promise<IRange | null> {
        // Normalize range (to exclude bookmarks)
        range.end =
            range.end > this._state.originalCount - 1 ? this._state.originalCount - 1 : range.end;
        return this._preload(range);
    }

    public getRowByPosition(position: number): IRow | undefined {
        return this._rows.find((row: IRow) => {
            return row.positionInStream === position;
        });
    }

    public scrollTo(row: number) {
        this._subjects.onScrollTo.next(row);
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

    private _getRowsSliced(from: number, to: number): IRow[] {
        const offset: number = this._state.stored.start > 0 ? this._state.stored.start : 0;
        return this._rows.slice(from - offset, to - offset);
    }

    private _onRowSelected(sender: string, selection: ISelectionAccessor, clicked: number) {
        if (sender === EParent.search) {
            return;
        }
        this._subjects.onScrollTo.next(clicked);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Bookmarks
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _onAddedBookmarksState(bookmark: IBookmark) {
        this._updateBookmarksData(bookmark);
    }

    private _onRemovedBookmarksState(index: number) {
        this._updateBookmarksData(undefined);
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
            this._subjects.onStateUpdated.next({
                isBookmarkInjection: true,
                state: Object.assign({}, this._state),
            });
        }
        if (bookmark !== undefined) {
            // Emit rerequest event
            this._subjects.onBookmarksChanged.next();
        }
    }

    private _insertBookmarks(rows: IRow[]): IRow[] {
        const bookmarks: Map<number, IBookmark> = this._accessor.session().getBookmarks().get();
        const indexes: number[] = Array.from(bookmarks.keys());
        const add = (target: IRow[], from: number, to: number) => {
            const between: number[] = this._getBetween(indexes, from, to);
            between.forEach((index: number) => {
                if (index === from || index === to) {
                    return;
                }
                const inserted: IBookmark | undefined = bookmarks.get(index);
                if (inserted === undefined) {
                    this._logger.warn(
                        `Fail to add bookmark with index ${index}. Bookmark isn't found`,
                    );
                    return;
                }
                target.push({
                    str: inserted.str,
                    positionInStream: inserted.position,
                    position: -1,
                    pluginId: inserted.pluginId,
                    sessionId: this._uuid,
                    parent: EParent.search,
                    api: this._accessor.session().getRowAPI(),
                });
                this._state.bookmarksCount += 1;
            });
        };
        this._state.bookmarksCount = 0;
        if (indexes.length === 0) {
            return rows;
        }
        indexes.sort((a, b) => a - b);
        const updated: IRow[] = [];
        if (rows.length === 0) {
            add(updated, -1, Infinity);
            return updated;
        }
        rows.forEach((row: IRow, i: number) => {
            if (i === rows.length - 1 && row.position !== this._state.originalCount - 1) {
                updated.push(row);
                return;
            } else if (i === rows.length - 1 && row.position === this._state.originalCount - 1) {
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

    private _removeBookmarks(rows: IRow[]): IRow[] {
        this._state.bookmarksCount = 0;
        return rows.filter((row: IRow) => {
            return row.position !== -1;
        });
    }

    private _getFirstPosNotBookmarkedRow(): { position: number; index: number } {
        for (let i = 0, max = this._rows.length - 1; i <= max; i += 1) {
            if (this._rows[i].position !== -1) {
                return { position: this._rows[i].position, index: i };
            }
        }
        return { position: -1, index: -1 };
    }

    private _getLastPosNotBookmarkedRow(): { position: number; index: number } {
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
            toEnd: this._state.originalCount - 1 - frame.end,
        };
        if (distance.toStart > Settings.maxRequestCount / 2) {
            request.start = distance.toStart - Settings.maxRequestCount / 2;
        } else {
            request.start = 0;
        }
        if (distance.toEnd > Settings.maxRequestCount / 2) {
            request.end = frame.end + Settings.maxRequestCount / 2;
        } else {
            request.end = this._state.originalCount - 1;
        }
        this._state.lastLoadingRequestId = setTimeout(() => {
            this._state.lastLoadingRequestId = undefined;
            this._requestData(request.start, request.end)
                .then((message: IPC.IValidSearchChunk) => {
                    // Check: response is empty
                    if (message.data === undefined) {
                        // Response is empty. Looks like search was dropped.
                        return;
                    }
                    // Check: do we already have other request
                    if (this._state.lastLoadingRequestId !== undefined) {
                        // No need to parse - new request was created
                        this._lastRequestedRows = [];
                        this._parse(
                            message.data,
                            message.start,
                            message.end,
                            this._lastRequestedRows,
                            frame,
                        );
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
                            rows: this._getRowsSliced(frame.start, frame.end + 1),
                        });
                        return;
                    } else {
                        this._logger.warn(
                            `Requested frame isn't in scope of stored data. Request - rows from ${request.start} to ${request.end}.`,
                        );
                    }
                })
                .catch((error: Error) => {
                    this._logger.error(
                        `Error during requesting data (rows from ${request.start} to ${request.end}): ${error.message}`,
                    );
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
            this._requestData(range.start, range.end)
                .then((message: IPC.IValidSearchChunk) => {
                    // Drop request ID
                    this._preloadTimestamp = -1;
                    // Update size of whole stream (real size - count of rows in stream file)
                    this._setTotalStreamCount(message.rows);
                    // Parse and accept rows
                    this._parse(message.data, message.start, message.end);
                    // Update bookmarks state
                    this._updateBookmarksData();
                    // Return actual preloaded range
                    resolve({ start: message.start, end: message.end });
                })
                .catch((error: Error) => {
                    // Drop request ID
                    this._preloadTimestamp = -1;
                    // Reject
                    reject(
                        new Error(
                            this._logger.error(
                                `Fail to preload data (rows from ${range.start} to ${range.end}) due error: ${error.message}`,
                            ),
                        ),
                    );
                });
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
    private _parse(input: string, from: number, to: number, dest?: IRow[], frame?: IRange): void {
        const rows: string[] = input.split(/\n/gi);
        let packets: IRow[] = [];
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
                const position: number = extractRowPosition(str); // Get position
                const pluginId: number = extractPluginId(str); // Get plugin id
                packets.push({
                    str: clearRowStr(str),
                    position: from + i,
                    positionInStream: position,
                    pluginId: pluginId,
                    sessionId: this._uuid,
                    parent: EParent.search,
                    api: this._accessor.session().getRowAPI(),
                });
            });
        } catch (e) {
            // do nothing
        }
        packets = packets.filter((packet: IRow) => {
            return packet.positionInStream !== -1;
        });
        if (dest !== undefined) {
            // Destination storage is defined: we don't need to store rows (accept it)
            dest.push(...packets);
        } else {
            if (packets.length !== to - from + 1) {
                throw new Error(
                    `Count of gotten rows dismatch with defined range. Range: ${from}-${to}. Actual count: ${
                        rows.length
                    }; expected count: ${to - from}.`,
                );
            }
            this._acceptPackets(packets);
        }
    }

    private _getPendingPackets(first: number, last: number): IRow[] {
        const rows: IRow[] = Array.from({ length: last - first }).map((_, i) => {
            return {
                position: first + i,
                positionInStream: first + i,
                str:
                    this._lastRequestedRows[i] === undefined
                        ? undefined
                        : this._lastRequestedRows[i].str,
                pluginId:
                    this._lastRequestedRows[i] === undefined
                        ? -1
                        : this._lastRequestedRows[i].pluginId,
                rank: this._accessor.session().getStreamOutput().getRank(),
                sessionId: this._uuid,
                parent: EParent.search,
                api: this._accessor.session().getRowAPI(),
            };
        });
        return rows;
    }
    /**
     * Adds new packet into stream and updates stream state
     * @param { IRow[] } packets - new packets to be added into stream
     * @param { number } start - number of first row in packets
     * @param { number } end - number of last row in packetes
     * @returns void
     */
    private _acceptPackets(packets: IRow[]): void {
        if (packets.length === 0) {
            return;
        }
        const packet: IRange = {
            start: packets[0].position,
            end: packets[packets.length - 1].position,
        };
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

    private _setTotalStreamCount(count: number) {
        this._state.originalCount = count;
        this._state.count = this._state.originalCount + this._state.bookmarksCount;
        if (this._state.count === 0) {
            return this.clearStream();
        }
    }

    private _requestData(start: number, end: number): Promise<IPC.IValidSearchChunk> {
        return new Promise((resolve, reject) => {
            const s = Date.now();
            ServiceElectronIpc.request<IPC.SearchChunk>(
                new IPC.SearchChunk({
                    guid: this._uuid,
                    start: start,
                    end: end,
                }),
                IPC.SearchChunk,
            ).then((response) => {
                this._logger.env(
                    `Chunk [${start} - ${end}] is read in: ${((Date.now() - s) / 1000).toFixed(
                        2,
                    )}s`,
                );
                if (response.error !== undefined) {
                    return reject(
                        new Error(
                            this._logger.warn(
                                `Request to stream chunk was finished within error: ${response.error}`,
                            ),
                        ),
                    );
                }
                if (
                    response.guid === undefined ||
                    response.data === undefined ||
                    response.length === undefined ||
                    response.rows === undefined
                ) {
                    return reject(
                        new Error(
                            this._logger.warn(
                                `SearchChunk returns invalid data ${JSON.stringify(response)}`,
                            ),
                        ),
                    );
                }
                resolve({
                    guid: response.guid,
                    data: response.data,
                    start: response.start,
                    end: response.end,
                    length: response.length,
                    rows: response.rows,
                });
            });
        });
    }

    private _onSelectAllSearchResult(event: IHotkeyEvent) {
        const active = this._accessor.session().getGuid();
        if (active !== event.session) {
            return;
        }
        const bookmarks: IBookmark[] = Array.from(
            this._accessor.session().getBookmarks().get().values(),
        );
        bookmarks.sort((a, b) => (a.position > b.position ? 1 : -1));
        const count = this._state.originalCount;
        if (count === 0) {
            if (bookmarks.length > 0) {
                OutputRedirectionsService.clear(active);
                bookmarks.forEach((bookmark: IBookmark) => {
                    OutputRedirectionsService.select(
                        EParent.search,
                        active,
                        { output: bookmark.position, search: -1 },
                        undefined,
                        EKey.ctrl,
                    );
                });
            }
            return;
        }
        const coors: {
            begin: IRow | undefined;
            end: IRow | undefined;
        } = {
            begin: undefined,
            end: undefined,
        };
        OutputRedirectionsService.clear(active);
        Promise.all([
            this.loadRange({ start: 0, end: 0 }).then((rows: IRow[]) => {
                if (rows.length !== 1) {
                    return;
                }
                coors.begin = rows[0];
            }),
            this.loadRange({ start: count - 1, end: count - 1 }).then((rows: IRow[]) => {
                if (rows.length !== 1) {
                    return;
                }
                coors.end = rows[0];
            }),
        ])
            .then(() => {
                if (coors.begin === undefined || coors.end === undefined) {
                    this._logger.warn(`Some ranges weren't found`);
                    return;
                }
                // Check first and last bookmarks
                if (bookmarks.length !== 0) {
                    const first = bookmarks[0];
                    const last = bookmarks[bookmarks.length - 1];
                    if (first.position < coors.begin.positionInStream) {
                        coors.begin.positionInStream = first.position;
                        coors.begin.position = -1;
                    }
                    if (last.position < coors.begin.positionInStream) {
                        coors.begin.positionInStream = last.position;
                        coors.begin.position = -1;
                    }
                }
                OutputRedirectionsService.select(
                    EParent.search,
                    active,
                    { output: coors.begin.positionInStream, search: coors.begin.position },
                    undefined,
                    EKey.ignore,
                );
                OutputRedirectionsService.select(
                    EParent.search,
                    active,
                    { output: coors.end.positionInStream, search: coors.end.position },
                    undefined,
                    EKey.shift,
                );
            })
            .catch((err: Error) => {
                this._logger.warn(`Fail request ranges due error: ${err.message}`);
            });
    }
}
