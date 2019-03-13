import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

export interface IStreamPacket {
    original: string;
    pluginId: number;
}

export class ControllerSessionTabStreamOutput extends DataSource<IStreamPacket> {

    private _dataStream: BehaviorSubject<IStreamPacket[]> = new BehaviorSubject<IStreamPacket[]>([]);
    private _rows: IStreamPacket[] = [];
    private _subscriptions: { [key: string]: Subscription | undefined } = { };

    constructor() {
        super();
    }

    public connect(collectionViewer: CollectionViewer): Observable<IStreamPacket[]> {
        return this._dataStream;
    }

    public disconnect(): void {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public write(input: string, pluginId: number): IStreamPacket {
        if (this._rows.length === 0) {
            this.next();
        }
        const index = this._rows.length - 1;
        this._rows[index].original += input;
        this._rows[index].pluginId = pluginId;
        this._dataStream.next(this._rows);
        return this._rows[index];
    }

    public next() {
        const last: number = this._rows.length - 1;
        if (last >= 0) {
            // Here parsers should be called
            // this._rows[last] = ansiToHTML(this._rows[last]);
        }
        this._rows.push({
            original: '',
            pluginId: -1
        });
        this._dataStream.next(this._rows);
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

}
