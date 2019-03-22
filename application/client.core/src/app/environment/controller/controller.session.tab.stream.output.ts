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
        updated: new Subject<void>(),
        scrollTo: new Subject<number>()
    };

    constructor(guid: string, requestDataHandler: TRequestDataHandler) {
        super();
        this._guid = guid;
        this._requestDataHandler = requestDataHandler;
        this._logger = new Toolkit.Logger(`ControllerSessionTabStreamOutput: ${this._guid}`);
    }

    public connect(collectionViewer: CollectionViewer): Observable<IStreamPacket[]> {
        return this._dataStream;
    }

    public disconnect(): void {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public getObservable(): {
        updated: Observable<void>,
        scrollTo: Observable<number>,
    } {
        return {
            updated: this._subjects.updated.asObservable(),
            scrollTo: this._subjects.scrollTo.asObservable(),
        };
    }

    public setViewport(startInView: number, endInView: number) {
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
    }

    // TODO: filter here should be removed -> bad data comes from process, it should be resolved there
    public update(input: string, start: number, end: number, count: number) {
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

    public clearStream() {
        this._rows = [];
        this._dataStream.next(this._rows);
    }

    public getRowsByIndexes(indexes: number[]): IStreamPacket[] {
        return indexes.map((index: number) => {
            return this._rows[index];
        });
    }

    private _requestUp() {
        const end: number = this._rows[0].position;
        this._requestDataHandler(end > BufferSettings.chunk ? (end - BufferSettings.chunk) : 0, end).then((duration: Error | number) => {
            if (duration instanceof Error) {
                this._position.requestedOnStartPoint = -1;
            }
        });
    }

    private _requestDown() {
        const start: number = this._rows[this._rows.length - 1].position;
        this._requestDataHandler(start, this._position.count > (start + BufferSettings.chunk) ? (start + BufferSettings.chunk) : this._position.count).then((duration: Error | number) => {
            if (duration instanceof Error) {
                this._position.requestedOnStartPoint = -1;
            }
        });
    }

    private _acceptPackets(packets: IStreamPacket[], first: number, last: number) {
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

    private _updatePositionByViewData(startInView, endInView) {
        this._position.startInStream = this._rows[startInView].position;
        this._position.endInStream = this._rows[endInView].position;
        this._position.start = this._rows[0].position;
        this._position.end = this._rows[this._rows.length - 1].position;
        this._position.toStart = this._position.startInStream - this._position.start;
        this._position.toEnd = this._position.end - this._position.endInStream;
    }

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

    // This method should be REMOVED
    private _extractRowPosition(rowStr: string): number {
        const value: RegExpMatchArray | null = rowStr.match(/\u0002(\d*)\u0002/gi);
        if (value === null || value.length !== 1) {
            return -1;
        }
        return parseInt(value[0].substring(1, value[0].length - 1), 10);
    }

    private _extractPluginId(rowStr: string): number {
        const value: RegExpMatchArray | null = rowStr.match(/\u0003(\d*)\u0003/gi);
        if (value === null || value.length !== 1) {
            return -1;
        }
        return parseInt(value[0].substring(1, value[0].length - 1), 10);
    }

    private _clearRowStr(str: string): string {
        return str.replace(/\u0002(\d*)\u0002/gi, '').replace(/\u0003(\d*)\u0003/gi, '');
    }

    private _getRowViewIndexByRowStreamIndex(index: number): number | undefined {
        for (let i = this._rows.length - 1; i >= 0; i -= 1) {
            if (this._rows[i].position === index) {
                return i;
            }
        }
    }

    private _emitUpdateEvent() {
        this._dataStream.next(this._rows);
        this._subjects.updated.next();
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
