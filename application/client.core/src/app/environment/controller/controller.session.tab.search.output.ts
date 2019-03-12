import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

export interface ISearchPacket {
    original: string;
    pluginId: number;
}

export class ControllerSessionTabStreamSearch extends DataSource<ISearchPacket> {

    private _dataStream: BehaviorSubject<ISearchPacket[]> = new BehaviorSubject<ISearchPacket[]>([]);
    private _rows: ISearchPacket[] = [];
    private _subscriptions: { [key: string]: Subscription | undefined } = { };

    constructor() {
        super();
    }

    public connect(collectionViewer: CollectionViewer): Observable<ISearchPacket[]> {
        return this._dataStream;
    }

    public disconnect(): void {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public add(original: string, pluginId: number): void {
        this._rows.push({
            original: original,
            pluginId: pluginId
        });
        this._dataStream.next(this._rows);
    }

    public clearStream() {
        this._rows = [];
        this._dataStream.next(this._rows);
    }

}
