import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { IPCMessages } from '../services/service.electron.ipc';
import { BehaviorSubject, Observable, Subscription, Subject } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';

export type TRequestDataHandler = (start: number, end: number) => Promise<Error | number>;

export interface IStreamPacket {
    str: string;
    position: number;
    pluginId: number;
    pending: boolean;
}

export interface IPosition {
    startInView: number;
    endInView: number;
    startInStorage: number;
    endInStorage: number;
    toStart: number;
    toEnd: number;
    rowsInStream: number;
    lastStartInView: number;
    requestedOnStartPoint: number;
    pendingStartInStorage: number;
    pedningEndInStorage: number;
}

export interface IUpdateData {
    rowsInStream: number;
    cursorInStream: number;
}

export interface IRange {
    start: number;
    end: number;
}

enum ELoadDirection {
    up = 'up',
    down = 'down',
}

export const BufferSettings = {
    triggeOn: 10000,    // count of rows to request new chunk
    chunk   : 50000,    // chunk size in rows
    limit   : 100000,   // limit of rows to have it in RAM. All above should be removed
};

export class ControllerSessionTabStreamOutput extends DataSource<IStreamPacket> {

    private _guid: string;
    private _logger: Toolkit.Logger;
    private _queue: Toolkit.Queue;
    private _dataStream: BehaviorSubject<IStreamPacket[]> = new BehaviorSubject<IStreamPacket[]>([]);
    private _rows: IStreamPacket[] = [];
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _requestDataHandler: TRequestDataHandler;
    private _requestTimer: any;
    private _position: IPosition = {
        startInView: -1,
        endInView: -1,
        startInStorage: -1,
        endInStorage: -1,
        toStart: 0,
        toEnd: 0,
        rowsInStream: 0,
        lastStartInView: -1,
        requestedOnStartPoint: -1,
        pedningEndInStorage: -1,
        pendingStartInStorage: -1,
    };

    private _subjects = {
        updated: new Subject<IUpdateData>(),
        scrollTo: new Subject<number>()
    };

    constructor(guid: string, requestDataHandler: TRequestDataHandler) {
        super();
        this._guid = guid;
        this._requestDataHandler = requestDataHandler;
        this._logger = new Toolkit.Logger(`ControllerSessionTabStreamOutput: ${this._guid}`);
        this._queue = new Toolkit.Queue(this._logger.env.bind(this));
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Service methods for "cdk-virtual-scroll" component
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

     /**
     * Conntect to data source
     * This method are used only by "cdk-virtual-scroll" component. Triggered on "cdk-virtual-scroll" created.
     * @param { CollectionViewer } collectionViewer - reference to component
     * @returns Observable<IStreamPacket[]>
     */
    public connect(collectionViewer: CollectionViewer): Observable<IStreamPacket[]> {
        return this._dataStream;
    }

    /**
     * Unsubscribe all exsisting events
     * This method are used only by "cdk-virtual-scroll" component. Triggered on "cdk-virtual-scroll" destroied.
     * @returns void
     */
    public disconnect(): void {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * API of controller
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

     /**
     * List of available observables.
     * @returns { updated: Observable<IUpdateData>, scrollTo: Observable<number>, }
     */
    public getObservable(): {
        updated: Observable<IUpdateData>,
        scrollTo: Observable<number>,
    } {
        return {
            updated: this._subjects.updated.asObservable(),
            scrollTo: this._subjects.scrollTo.asObservable(),
        };
    }

    /**
     * Update state of viewport: setup parameters of visible rows in viewport.
     * @param { number } startInView - first visible row in viewport
     * @param { number } endInView - last visible row in viewport
     * @returns void
     */
    public setViewport(startInView: number, endInView: number): void {
        if (this._rows[startInView] === void 0 || this._rows[endInView] === void 0) {
            this._logger.warn(`Fail to detect range rows in stream by range of view. Start: ${this._rows[startInView]}; end: ${this._rows[endInView]}.`);
            return;
        }
        this._updatePositionByViewData(startInView, endInView);
        const direction: ELoadDirection | undefined = this._getLoadDirection();
        this._position.lastStartInView = this._position.startInView;
        if (direction === undefined) {
            return;
        }
        if (this._position.requestedOnStartPoint !== -1) {
            // Request is in progress
            return;
        }
        this._position.requestedOnStartPoint = this._position.startInView;
        switch (direction) {
            case ELoadDirection.up:
                this._requestUp();
                break;
            case ELoadDirection.down:
                this._requestDown();
                break;
        }
    }

    public isRequestNeeded(startInView: number, endInView: number): boolean {
        const state: IPosition = Object.assign({}, this._position);
        state.startInView = this._rows[startInView].position;
        state.endInView = this._rows[endInView].position;
        state.startInStorage = this._rows[0].position;
        state.endInStorage = this._rows[this._rows.length - 1].position;
        state.toStart = state.startInView - state.startInStorage;
        state.toEnd = state.endInStorage - state.endInView;
        const direction: ELoadDirection | undefined = this._getLoadDirection();
        if (direction === undefined) {
            return false;
        }
        if (this._position.requestedOnStartPoint !== -1) {
            return false;
        }
        return true;
    }

    /**
     * Add new rows into output.
     * @param { string } input - string with rows data
     * @param { number } start - number of first row in "input"
     * @param { number } end - number of last row in "input"
     * @param { number } count - total count of rows in whole stream (not in input, but in whole stream)
     * @returns void
     */
    public update(input: string, start: number, end: number, rowsInStream: number): void {
        // TODO: filter here should be removed -> bad data comes from process, it should be resolved there
        let rows: string[] = input.split(/\n/gi);
        if (rows.length > (end - start)) {
            // Remove last one, which could be not completed
            rows = rows.slice(0, (end - start));
        }
        // Conver rows to packets
        const packets: IStreamPacket[] = rows.map((str: string) => {
            return {
                str: this._clearRowStr(str),                // Get cleared string
                position: this._extractRowPosition(str),    // Get position
                pluginId: this._extractPluginId(str),       // Get plugin id
                pending: false,                             // Not pending row (row with content)
            };
        }).filter((packet: IStreamPacket) => {
            return (packet.position !== -1);
        });
        // Update size of whole stream (real size - count of rows in stream file)
        this._position.rowsInStream = rowsInStream;
        // this._queue.add(this._acceptPackets.bind(this, packets, start, end));
        this._acceptPackets(packets, start, end, false);
    }

    /**
     * Returns total count of rows in whole stream
     * @returns number
     */
    public getRowsCountInStream(): number {
        return this._position.rowsInStream;
    }

    /**
     * Returns total count of rows in storage
     * @returns number
     */
    public getRowsCountInStorage(): number {
        return this._rows.length;
    }

    /**
     * Returns first row in storage
     * @returns number
     */
    public getStartInStorage(): number {
        return this._position.startInStorage;
    }

    /**
     * Returns last row in storage
     * @returns number
     */
    public getLastInStorage(): number {
        return this._position.endInStorage;
    }

    /**
     * Returns stream packet for row in view
     * @returns IStreamPacket | undefined
     */
    public getRow(index: number): IStreamPacket | undefined {
        return this._rows[index];
    }

    /**
     * Cleans whole stream
     * @returns void
     */
    public clearStream(): void {
        this._rows = [];
        this._dataStream.next(this._rows);
    }

    /**
     * Update length of stream and returns needed range of rows to fit maximum buffer (considering current cursor position).
     * @param { number } rows - number or rows in stream
     * @returns { IRange | undefined } returns undefined if no need to load rows
     */
    public updateStreamState(message: IPCMessages.StreamUpdated): IRange | undefined {
        const updated: IRange = { start: this._position.rowsInStream, end: message.rowsCount - 1 };
        this._position.rowsInStream = message.rowsCount;
        if ((this._position.endInStorage + 1) === message.addedFrom) {
            this.update(message.addedRowsData, message.addedFrom, message.addedTo, message.rowsCount);
            return undefined;
        }
        if (updated.start >= this._position.startInView) {
            // Stream updated after current cursor position
            let requestedEndInStream: number = this._position.startInView + BufferSettings.chunk;
            requestedEndInStream = requestedEndInStream > updated.end ? updated.end : requestedEndInStream;
            if (this._position.endInStorage >= requestedEndInStream) {
                // No need to update, because already have in storage.
                return undefined;
            }
            return {
                start: this._position.endInStorage + 1,
                end: requestedEndInStream
            };
        }

    }

    // TODO: this method is depricated. Should be removed after search will be updated
    public getRowsByIndexes(indexes: number[]): IStreamPacket[] {
        return indexes.map((index: number) => {
            return this._rows[index];
        });
    }

    /**
     * Finds and returs index or row in viewport but index of row in stream.
     * If index not found returs { undefined }
     * @param { number } index - index of row in stream
     * @returns number | undefined
     */
    public getRowIndexInStorageByIndexInStream(indexInStream: number): number | undefined {
        for (let i = this._rows.length - 1; i >= 0; i -= 1) {
            if (this._rows[i].position === indexInStream) {
                return i;
            }
        }
        return -1;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Internal methods / helpers
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    /**
     * Requested data from process. Requeste data before current cursor.
     * @returns void
     */
     private _requestUp(): void {
        const end: number = this._rows[0].position;
        const start: number = end > BufferSettings.chunk ? (end - BufferSettings.chunk) : 0;
        this._acceptPackets([], start, end, true);
        clearTimeout(this._requestTimer);
        this._requestTimer = setTimeout(() => {
            this._requestDataHandler(start, end).then((duration: Error | number) => {
                if (duration instanceof Error) {
                    this._position.requestedOnStartPoint = -1;
                }
            });
        }, 150);
    }

    /**
     * Requested data from process. Requeste data after current cursor.
     * @returns void
     */
    private _requestDown() {
        const start: number = this._rows[this._rows.length - 1].position;
        const maxEndPosition: number = start + BufferSettings.chunk;
        const end: number = (this._position.rowsInStream - 1) > maxEndPosition ? maxEndPosition : (this._position.rowsInStream - 1);
        this._acceptPackets([], start, end, true);
        clearTimeout(this._requestTimer);
        this._requestTimer = setTimeout(() => {
            this._requestDataHandler(start, end).then((duration: Error | number) => {
                if (duration instanceof Error) {
                    this._position.requestedOnStartPoint = -1;
                }
            });
        }, 150);
    }

    private _getPendingPackages(first: number, last: number): IStreamPacket[] {
        const rows: IStreamPacket[] = Array.from({ length: last - first}).map((_, i) => {
            return {
                pluginId: -1,
                position: first + i,
                str: '',
                pending: true
            };
        });
        return rows;
    }
    /**
     * Adds new packet into stream and updates stream state
     * @param { IStreamPacket[] } packets - new packets to be added into stream
     * @param { number } first - number of first row in packets
     * @param { number } last - number of last row in packetes
     * @returns void
     */
    private _acceptPackets(packets: IStreamPacket[], first: number, last: number, pending: boolean): void {
        if (!pending) {
            // Remove pending before
            this._rows = this._rows.filter((row: IStreamPacket) => {
                return !row.pending;
            });
            if (this._rows.length > 0) {
                // Update border
                this._position.startInStorage = this._rows[0].position;
                this._position.endInStorage = this._rows[this._rows.length - 1].position;
            }
        } else {
            packets = this._getPendingPackages(first, last);
        }
        // Add rows
        if (this._rows.length === 0) {
            this._rows.push(...packets);
            this._emitUpdateEvent();
            return;
        }
        // Detect position of package
        if (first < this._position.startInStorage) {
            // Package before current position
            if (last > this._position.startInStorage) {
                // Package overlap current position. Crop it
                const toCrop: number = last - this._position.startInStorage;
                packets.splice(-toCrop, toCrop);
            }
            // Add data before
            this._rows.unshift(...packets);
            // Check size
            if (this._rows.length > BufferSettings.limit) {
                const toCrop: number = this._rows.length - BufferSettings.limit;
                // Remove from the end
                this._rows.splice(-toCrop, toCrop);
            }
        } else if (last > this._position.endInStorage) {
            // Package after current position
            if (first < this._position.endInStorage) {
                // Package overlap current position. Crop it
                const toCrop: number = this._position.endInStorage - first + 1;
                packets.splice(0, toCrop);
            }
            // Add data after
            this._rows.push(...packets);
            // Check size
            if (this._rows.length > BufferSettings.limit) {
                const toCrop: number = this._rows.length - BufferSettings.limit;
                // Remove from the begin
                this._rows.splice(0, toCrop);
            }
        }
        this._emitUpdateEvent();
    }

    /**
     * Updates cursor state of stream (parameters of visible part of stream)
     * @param { IStreamPacket[] } packets - new packets to be added into stream
     * @param { number } startInView - first visible row
     * @param { number } endInView - last visible row
     * @returns void
     */
    private _updatePositionByViewData(startInView: number, endInView: number): void {
        this._position.startInView = this._rows[startInView].position;
        this._position.endInView = this._rows[endInView].position;
        this._position.startInStorage = this._rows[0].position;
        this._position.endInStorage = this._rows[this._rows.length - 1].position;
        this._position.toStart = this._position.startInView - this._position.startInStorage;
        this._position.toEnd = this._position.endInStorage - this._position.endInView;
    }

    /**
     * Detects direction of required loading of new data into steam: before cursor or after
     * @returns ELoadDirection | undefined
     */
    private _getLoadDirection(target?: IPosition): ELoadDirection | undefined {
        if (target === undefined) {
            target = this._position;
        }
        if (target.lastStartInView === -1) {
            return undefined;
        }
        if (target.lastStartInView > target.startInView) {
            // Cursor moves to start
            if (target.toStart > BufferSettings.triggeOn) {
                // Do not trigger extra data, because it's still far from unloaded data
                return;
            }
            if (target.startInStorage <= 1) {
                // No need to load, because it's beggining
                return;
            }
            // Request data in UP directioon
            return ELoadDirection.up;
        } else {
            // Cursor moves to end
            if (target.toEnd > BufferSettings.triggeOn) {
                // Do not trigger extra data, because it's still far from unloaded data
                return;
            }
            if (target.endInStorage >= target.rowsInStream - 1) {
                // No need to load, because it's end of data
                return;
            }
            // Request data in DOWN direction
            return ELoadDirection.down;
        }
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

    /**
     * Triggers update events and force scrolling in viewport
     * @returns void
     */
    private _emitUpdateEvent() {
        this._dataStream.next(this._rows);
        this._subjects.updated.next({
            rowsInStream: this._position.rowsInStream,
            cursorInStream: this._position.requestedOnStartPoint
        });
        this._position.requestedOnStartPoint = -1;
    }

}
