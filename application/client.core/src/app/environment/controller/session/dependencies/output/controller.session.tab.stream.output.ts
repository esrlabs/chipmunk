import { IPCMessages } from '../../../../services/service.electron.ipc';
import { Observable, Subject, Subscription } from 'rxjs';
import { ControllerSessionTabStreamBookmarks } from '../bookmarks/controller.session.tab.stream.bookmarks';
import { ControllerSessionScope } from '../scope/controller.session.tab.scope';
import { ControllerSessionTabTimestamp } from '../timestamps/session.dependency.timestamps';
import { clearRowStr } from '../../../helpers/row.helpers';
import { ISelectionAccessor, EParent } from '../../../../services/standalone/service.output.redirections';
import { IRow } from '../row/controller.row.api';
import { Dependency, SessionGetter } from '../session.dependency';
import { CommonInterfaces } from '../../../../interfaces/interface.common';

import { StreamDataProvider } from '../../../providers/provider.stream';
import { StreamDataAccessor, IData } from '../../../providers/accessor.stream';

import OutputRedirectionsService from '../../../../services/standalone/service.output.redirections';
import ServiceElectronIpc from '../../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export type TRequestDataHandler = (start: number, end: number) => Promise<IPCMessages.StreamChunk>;

export interface IParamerters {
    guid: string;
    requestDataHandler: TRequestDataHandler;
    bookmarks: ControllerSessionTabStreamBookmarks;
    scope: ControllerSessionScope;
    timestamp: ControllerSessionTabTimestamp;
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
    rows: IRow[];
}

export interface IPositionData {
    start: number;
    count: number;
}

export const Settings = {
    trigger         : 400,       // Trigger to load addition chunk
    maxRequestCount : 2000,      // chunk size in rows
    maxStoredCount  : 2000,      // limit of rows to have it in RAM. All above should be removed
    requestDelay    : 0,         // ms, delay before to do request
};

export class ControllerSessionTabStreamOutput implements Dependency {

    private readonly _guid: string;
    private readonly _logger: Toolkit.Logger;
    private readonly _subscriptions: { [key: string]: Toolkit.Subscription | Subscription} = {};
    private readonly _provider: StreamDataProvider;
    private readonly _session: SessionGetter;
    private readonly _subjects = {
        onStateUpdated: new Subject<IStreamState>(),
        onRangeLoaded: new Subject<ILoadedRange>(),
        onReset: new Subject<void>(),
        onScrollTo: new Subject<number>(),
        onSelected: new Subject<number>(),
        onRankChanged: new Subject<number>(),
        onSourceChanged: new Subject<number>(),
        onHorScrollOffset: new Subject<number>(),
        onPositionChanged: new Subject<IPositionData>(),
    };

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
    private _rows: IRow[] = [];
    private _horScrollOffset: number = 0;
    private _lastRequestedRows: IRow[] = [];

    constructor(
        uuid: string,
        getter: SessionGetter
    ) {
        this._guid = uuid;
        this._session = getter;
        this._logger = new Toolkit.Logger(`ControllerSessionTabStreamOutput: ${this._guid}`);
        this._provider = new StreamDataProvider(uuid, new StreamDataAccessor(uuid));
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._subscriptions.onRowSelected = OutputRedirectionsService.subscribe(this._guid, this._onRowSelected.bind(this));
            this._subscriptions.onBookmarkRowSelected = this._session().getBookmarks().getObservable().onSelected.subscribe(this._onRowSelected.bind(this, EParent.bookmark, {}));
            this._subscriptions.onProviderChunk = this._provider.subjects().chunk.subscribe(this._onProviderChunk.bind(this));
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ControllerSessionTabStreamOutput';
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * API of controller
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
     /**
     * List of available observables.
     * @returns { onStateUpdated: Observable<IStreamState>, onRangeLoaded: Observable<ILoadedRange>, onReset: Observable<void>, onScrollTo: Observable<number>, onSelected: Observable<number>, onRankChanged: Observable<number> }
     */
    public getObservable(): {
        onStateUpdated: Observable<IStreamState>,
        onRangeLoaded: Observable<ILoadedRange>,
        onReset: Observable<void>,
        onScrollTo: Observable<number>,
        onSelected: Observable<number>,
        onRankChanged: Observable<number>,
        onSourceChanged: Observable<number>,
        onHorScrollOffset: Observable<number>,
        onPositionChanged: Observable<IPositionData>,
    } {
        return {
            onStateUpdated: this._subjects.onStateUpdated.asObservable(),
            onRangeLoaded: this._subjects.onRangeLoaded.asObservable(),
            onReset: this._subjects.onReset.asObservable(),
            onScrollTo: this._subjects.onScrollTo.asObservable(),
            onSelected: this._subjects.onSelected.asObservable(),
            onRankChanged: this._subjects.onRankChanged.asObservable(),
            onSourceChanged: this._subjects.onSourceChanged.asObservable(),
            onHorScrollOffset: this._subjects.onHorScrollOffset.asObservable(),
            onPositionChanged: this._subjects.onPositionChanged.asObservable(),
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
        if (isNaN(range.start) || isNaN(range.end) || !isFinite(range.start) || !isFinite(range.end)) {
            return new Error(`Range has incorrect format. Start and end shound be finite and not NaN`);
        }
        const stored = Object.assign({}, this._state.stored);
        if (this._state.count === 0 || range.start < 0 || range.end < 0) {
            this._subjects.onPositionChanged.next({
                start: 0,
                count: 0,
            });
            return [];
        }
        if (range.start === 0 && range.end === 0 && this._state.count !== 1) {
            this._subjects.onPositionChanged.next({
                start: 0,
                count: 0,
            });
            return [];
        }
        if (stored.start >= 0 && stored.end >= 0) {
            if (range.start >= stored.start && range.end <= stored.end) {
                rows = this._getRowsSliced(range.start, range.end + 1);
                this._subjects.onSourceChanged.next(rows[0].pluginId);
            } else if (range.end > stored.start && range.start <= stored.start && range.end < stored.end) {
                rows = this._getPendingPackets(range.start, stored.start);
                rows.push(...this._getRowsSliced(stored.start, range.end + 1));
            } else if (range.start < stored.end && range.start >= stored.start && range.end > stored.end) {
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
            return new Error(this._logger.error(`Calculation error: gotten ${rows.length} rows; should be: ${range.end - range.start + 1}. State was { start: ${stored.start}, end: ${stored.end}}, became { start: ${this._state.stored.start}, end: ${this._state.stored.end}}.`));
        }
        this._state.frame = Object.assign({}, range);
        // Trigger position event
        this._subjects.onPositionChanged.next({
            start: range.start,
            count: range.end - range.start,
        });
        return rows;
    }

    public loadRange(range: IRange): Promise<IRow[]> {
        return new Promise((resolve, reject) => {
            if (isNaN(range.start) || isNaN(range.end) || !isFinite(range.start) || !isFinite(range.end)) {
                return reject(new Error(`Range has incorrect format. Start and end shound be finite and not NaN`));
            }
            const stored = Object.assign({}, this._state.stored);
            if (range.start >= stored.start && range.end <= stored.end) {
                return resolve(this._getRowsSliced(range.start, range.end + 1));
            }
            resolve([]);
            // this._requestData(range.start, range.end).then((message: IPCMessages.StreamChunk) => {
            //     const packets: IRow[] = [];
            //     this._parse(message.data, message.start, packets);
            //     resolve(packets.filter((packet: IRow) => {
            //         return packet.position >= range.start && packet.position <= range.end;
            //     }));
            // }).catch((error: Error) => {
            //     reject(new Error(`Error during requesting data (rows from ${range.start} to ${range.end}): ${error.message}`));
            // });
        });
    }

    public setFrame(range: IRange) {
        if (this._state.count === 0) {
            return;
        }
        this._state.frame = { start: range.start, end: range.end };
        if (!this._load()) {
            // No need to make request, but check buffer
            // this._buffer();
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
        this._setTotalStreamCount(message.rows);
        this._subjects.onStateUpdated.next(Object.assign({}, this._state));
    }

    public getBookmarks(): ControllerSessionTabStreamBookmarks {
        return this._session().getBookmarks();
    }

    public getRowsCount(): number {
        return this._state.count;
    }

    public setHorScrollOffset(offset: number) {
        this._horScrollOffset = offset;
        this._subjects.onHorScrollOffset.next(offset);
    }

    public getHorScrollOffset(): number {
        return this._horScrollOffset;
    }

    public getRowByPosition(position: number): IRow | undefined {
        return this._rows.find((row: IRow) => {
            return row.position === position;
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Rows operations
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _getRowsSliced(from: number, to: number): IRow[] {
        const offset: number = this._state.stored.start > 0 ? this._state.stored.start : 0;
        return this._rows.slice(from - offset, to - offset);
    }

    private _onRowSelected(sender: EParent, selection: ISelectionAccessor, clicked: number) {
        if (sender === EParent.output) {
            return;
        }
        this._subjects.onScrollTo.next(clicked);
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
            toEnd: this._state.count - frame.end
        };
        if (distance.toStart > (Settings.maxRequestCount / 2)) {
            request.start = distance.toStart - (Settings.maxRequestCount / 2);
        } else {
            request.start = 0;
        }
        if (distance.toEnd > (Settings.maxRequestCount / 2)) {
            request.end = frame.end + (Settings.maxRequestCount / 2);
        } else {
            request.end = this._state.count;
        }
        const error: Error | undefined = this._provider.request({
            from: request.start,
            to: request.end,
        });
        if (error instanceof Error) {
            this._logger.error(`Fail request chunk. Error: ${error.message}`);
        }
    }

    /**
     * Add new rows into output.
     * @param { string } input - string with rows data
     * @param { number } start - number of first row in "input"
     * @param { number } end - number of last row in "input"
     * @param { number } count - total count of rows in whole stream (not in input, but in whole stream)
     * @returns void
     */
    private _parse(rows: CommonInterfaces.API.IGrabbedElement[], start: number, dest?: IRow[], frame?: IRange): void {
        let packets: IRow[] = [];
        // Conver rows to packets
        try {
            rows.forEach((row: CommonInterfaces.API.IGrabbedElement, i: number) => {
                packets.push({
                    str: clearRowStr(row.content),
                    position: typeof row.row === 'number' ? row.row : start + i,
                    positionInStream: typeof row.position === 'number' ? row.position : start + i,
                    pluginId: 1,
                    sessionId: this._guid,
                    parent: EParent.output,
                    api: this._session().getRowAPI(),
                });
            });
        } catch (e) {
            // do nothing
        }
        packets = packets.filter((packet: IRow) => {
            return (packet.position !== -1);
        });
        if (dest !== undefined) {
            // Destination storage is defined: we don't need to store rows (accept it)
            dest.push(...packets);
        } else {
            this._acceptPackets(packets);
        }
    }

    private _getPendingPackets(first: number, last: number): IRow[] {
        const rows: IRow[] = Array.from({ length: last - first}).map((_, i) => {
            return {
                pluginId: this._lastRequestedRows[i] === undefined ? -1 : this._lastRequestedRows[i].pluginId,
                position: first + i,
                positionInStream: first + i,
                str: this._lastRequestedRows[i] === undefined ? undefined : this._lastRequestedRows[i].str,
                rank: this._state.countRank,
                sessionId: this._guid,
                parent: EParent.output,
                api: this._session().getRowAPI(),
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
        const size: number = this._rows.length;
        const packet: IRange = { start: packets[0].position, end: packets[packets.length - 1].position};
        if (this._rows.length === 0) {
            this._rows.push(...packets);
        } else if (packet.start === this._state.stored.end + 1) {
            this._rows.push(...packets);
            // Check size
            if (this._rows.length > Settings.maxStoredCount) {
                const toCrop: number = this._rows.length - Settings.maxStoredCount;
                // Remove from the begin
                this._rows.splice(0, toCrop);
            }
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
        if (size === 0 && this._rows.length !== 0) {
            this._subjects.onSourceChanged.next(this._rows[0].pluginId);
        }
    }

    private _setTotalStreamCount(count: number) {
        this._state.count = count;
        if (count === 0) {
            return this.clearStream();
        }
        const changed: boolean = this._state.countRank !== count.toString().length;
        this._state.countRank = count.toString().length;
        if (changed) {
            this._subjects.onRankChanged.next(this._state.countRank);
        }
    }

    private _onProviderChunk(data: IData) {
        // Update size of whole stream (real size - count of rows in stream file)
        this._setTotalStreamCount(data.count);
        // Parse and accept rows
        this._parse(data.rows, data.from);
        this._lastRequestedRows = this._getRowsSliced(data.from, data.to + 1);
        // Check again last requested frame
        this._subjects.onRangeLoaded.next({
            range: { start: data.from, end: data.to },
            rows: this._lastRequestedRows
        });
    }

    // private _requestData(start: number, end: number): Promise<IPCMessages.StreamChunk> {
    //     return new Promise((resolve, reject) => {
    //         const error = this._provider.request({ from: start, to: end });
    //         if (error instanceof Error) {
    //             console.error(error);
    //         }
    //         const s = Date.now();
    //         ServiceElectronIpc.request(
    //             new IPCMessages.StreamChunk({
    //                 guid: this._guid,
    //                 start: start,
    //                 end: end
    //             }), IPCMessages.StreamChunk
    //         ).then((response: IPCMessages.StreamChunk) => {
    //             this._logger.env(`Chunk [${start} - ${end}] is read in: ${((Date.now() - s) / 1000).toFixed(2)}s`);
    //             if (response.error !== undefined) {
    //                 return reject(new Error(this._logger.warn(`Request to stream chunk was finished within error: ${response.error}`)));
    //             }
    //             resolve(response);
    //         });
    //     });
    // }

}
