import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, Subscription, Subject } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';

export type TRequestDataHandler = (start: number, end: number) => Promise<Error | number>;

export interface IStreamPacket {
    str: string;
    position: number;
    pluginId: number;
}

export interface IPosition {
    startInStream: number;
    endInStream: number;
    start: number;
    end: number;
    toStart: number;
    toEnd: number;
    count: number;
    lastStartInStream: number;
    requestedOnStartPoint: number;
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
    private _dataStream: BehaviorSubject<IStreamPacket[]> = new BehaviorSubject<IStreamPacket[]>([]);
    private _rows: IStreamPacket[] = [];
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _requestDataHandler: TRequestDataHandler;
    private _position: IPosition = {
        startInStream: -1,
        endInStream: -1,
        start: -1,
        end: -1,
        toStart: -1,
        toEnd: -1,
        count: -1,
        lastStartInStream: -1,
        requestedOnStartPoint: -1,
    };

    private _subjects = {
        updated: new Subject<number>(),
        scrollTo: new Subject<number>()
    };

    constructor(guid: string, requestDataHandler: TRequestDataHandler) {
        super();
        this._guid = guid;
        this._requestDataHandler = requestDataHandler;
        this._logger = new Toolkit.Logger(`ControllerSessionTabStreamOutput: ${this._guid}`);
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
     * @returns { updated: Observable<number>, scrollTo: Observable<number>, }
     */
    public getObservable(): {
        updated: Observable<number>,
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
        this._position.lastStartInStream = this._position.startInStream;
        if (direction === undefined) {
            return;
        }
        if (this._position.requestedOnStartPoint !== -1) {
            // Request is in progress
            return;
        }
        this._position.requestedOnStartPoint = this._position.startInStream;
        switch (direction) {
            case ELoadDirection.up:
                this._requestUp();
                break;
            case ELoadDirection.down:
                this._requestDown();
                break;
        }
        console.log(this._rows.length);
    }

    /**
     * Add new rows into output.
     * @param { string } input - string with rows data
     * @param { number } start - number of first row in "input"
     * @param { number } end - number of last row in "input"
     * @param { number } count - total count of rows in whole stream (not in input, but in whole stream)
     * @returns void
     */
    public update(input: string, start: number, end: number, count: number): void {
        // TODO: filter here should be removed -> bad data comes from process, it should be resolved there
        const rows: string[] = input.split(/\n/gi);
        // Conver rows to packets
        const packets: IStreamPacket[] = rows.map((str: string) => {
            return {
                str: this._clearRowStr(str),                // Get cleared string
                position: this._extractRowPosition(str),    // Get position
                pluginId: this._extractPluginId(str),       // Get plugin id
            };
        }).filter((packet: IStreamPacket) => {
            return packet.position !== -1;
        });
        // Update size of whole stream (real size - count of rows in stream file)
        this._position.count = count;
        this._acceptPackets(packets, start, end);
    }

    /**
     * Returns total count of rows in whole stream
     * @returns number
     */
    public getRowsCount(): number {
        return this._position.count;
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

    // TODO: this method is depricated. Should be removed after search will be updated
    public getRowsByIndexes(indexes: number[]): IStreamPacket[] {
        return indexes.map((index: number) => {
            return this._rows[index];
        });
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
        this._requestDataHandler(end > BufferSettings.chunk ? (end - BufferSettings.chunk) : 0, end).then((duration: Error | number) => {
            if (duration instanceof Error) {
                this._position.requestedOnStartPoint = -1;
            }
        });
    }

    /**
     * Requested data from process. Requeste data after current cursor.
     * @returns void
     */
    private _requestDown() {
        const start: number = this._rows[this._rows.length - 1].position;
        this._requestDataHandler(start, this._position.count > (start + BufferSettings.chunk) ? (start + BufferSettings.chunk) : this._position.count).then((duration: Error | number) => {
            if (duration instanceof Error) {
                this._position.requestedOnStartPoint = -1;
            }
        });
    }

    /**
     * Adds new packet into stream and updates stream state
     * @param { IStreamPacket[] } packets - new packets to be added into stream
     * @param { number } first - number of first row in packets
     * @param { number } last - number of last row in packetes
     * @returns void
     */
    private _acceptPackets(packets: IStreamPacket[], first: number, last: number): void {
        if (this._rows.length === 0) {
            this._rows.push(...packets);
            this._emitUpdateEvent();
            return;
        }
        // Detect position of package
        if (first < this._position.start) {
            // Package before current position
            if (last > this._position.start) {
                // Package overlap current position. Crop it
                const toCrop: number = last - this._position.start;
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
        } else if (last > this._position.end) {
            // Package after current position
            if (first < this._position.end) {
                // Package overlap current position. Crop it
                const toCrop: number = this._position.end - first;
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
        this._position.startInStream = this._rows[startInView].position;
        this._position.endInStream = this._rows[endInView].position;
        this._position.start = this._rows[0].position;
        this._position.end = this._rows[this._rows.length - 1].position;
        this._position.toStart = this._position.startInStream - this._position.start;
        this._position.toEnd = this._position.end - this._position.endInStream;
    }

    /**
     * Detects direction of required loading of new data into steam: before cursor or after
     * @returns ELoadDirection | undefined
     */
    private _getLoadDirection(): ELoadDirection | undefined {
        if (this._position.lastStartInStream === -1) {
            return undefined;
        }
        if (this._position.lastStartInStream > this._position.startInStream) {
            // Cursor moves to start
            if (this._position.toStart > BufferSettings.triggeOn) {
                // Do not trigger extra data, because it's still far from unloaded data
                return;
            }
            if (this._position.start <= 1) {
                // No need to load, because it's beggining
                return;
            }
            // Request data in UP directioon
            return ELoadDirection.up;
        } else {
            // Cursor moves to end
            if (this._position.toEnd > BufferSettings.triggeOn) {
                // Do not trigger extra data, because it's still far from unloaded data
                return;
            }
            if (this._position.end >= this._position.count - 1) {
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
     * Finds and returs index or row in viewport but index of row in stream.
     * If index not found returs { undefined }
     * @param { number } index - index of row in stream
     * @returns number | undefined
     */
    private _getRowViewIndexByRowStreamIndex(index: number): number | undefined {
        for (let i = this._rows.length - 1; i >= 0; i -= 1) {
            if (this._rows[i].position === index) {
                return i;
            }
        }
    }

    /**
     * Triggers update events and force scrolling in viewport
     * @returns void
     */
    private _emitUpdateEvent() {
        this._dataStream.next(this._rows);
        this._subjects.updated.next(this._position.count);
        if (this._position.requestedOnStartPoint !== -1) {
            const index: number | undefined = this._getRowViewIndexByRowStreamIndex(this._position.requestedOnStartPoint);
            this._position.requestedOnStartPoint = -1;
            if (index === undefined) {
                this._logger.warn(`Cannot find row index in view by row index in stream.`);
                return;
            }
            this._subjects.scrollTo.next(index);
        }
    }

}
