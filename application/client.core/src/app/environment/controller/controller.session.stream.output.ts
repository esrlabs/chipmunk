import {CollectionViewer, DataSource} from '@angular/cdk/collections';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import { IStreamPacket } from './controller.session.stream';

export class ControllerSessionStreamOutput extends DataSource<IStreamPacket> {
    private _dataStream: BehaviorSubject<IStreamPacket[]> = new BehaviorSubject<IStreamPacket[]>([]);
    private _packets: IStreamPacket[] = [];
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

    public pushToStream(packet: IStreamPacket) {
        this._packets.push(packet);
        this._dataStream.next(this._packets);
    }

    public clearStream() {
        this._packets = [];
        this._dataStream.next(this._packets);
    }

}
