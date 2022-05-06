import { Subscription, Subject } from '@platform/env/subscription';
import { Service, Range, IRowsPacket } from './service';
import { IRange, Range as SafeRange } from '@platform/types/range';
import { Holder } from './holder';
import { Row } from '@schema/content/row';

export enum ChangesInitiator {
    Wheel = 0,
    StorageUpdated = 1,
    HolderHeight = 2,
    Scrolling = 3,
    RowsDelivered = 4,
    Selecting = 5,
}

export interface PositionEvent {
    range: IRange;
    initiator: ChangesInitiator;
}

export class Frame {
    private _service!: Service;
    private _holder!: Holder;
    private _subscriptions: Map<string, Subscription> = new Map();
    private _frame: Range = new Range();
    private _rows: Row[] = [];
    private readonly _subjects: {
        change: Subject<Row[]>;
        position: Subject<PositionEvent>;
    } = {
        change: new Subject<Row[]>(),
        position: new Subject<PositionEvent>(),
    };

    public bind(service: Service, holder: Holder) {
        this._service = service;
        this._holder = holder;
        this._subscriptions.set(
            'onFrameChange',
            this._frame.onChange((initiator: ChangesInitiator) => {
                this._subjects.position.emit({ range: this._frame.get(), initiator });
                this._service.setFrame(this._frame.get());
            }),
        );
        this._subscriptions.set(
            'onHeightChange',
            this._holder.onHeightChange((height: number) => {
                this._frame.setLength(
                    Math.floor(height / this._service.getItemHeight()),
                    ChangesInitiator.HolderHeight,
                );
                this._service.setFrame(this._frame.get());
            }),
        );
        this._subscriptions.set(
            'onRowsDelivered',
            this._service.onRows((packet: IRowsPacket) => {
                if (!this._frame.equal(packet.range)) {
                    return;
                }
                this._rows = packet.rows;
                this._subjects.change.emit(this._rows);
            }),
        );
        this._subscriptions.set(
            'onStorageUpdated',
            this._service.onLen((len: number) => {
                this._frame.setTotal(len, ChangesInitiator.StorageUpdated);
            }),
        );
    }

    public destroy(): void {
        this._subscriptions.forEach((subscription: Subscription) => {
            subscription.unsubscribe();
        });
        this._subjects.change.destroy();
        this._subjects.position.destroy();
    }

    public init() {
        this._frame.setLength(
            Math.floor(this._holder.getHeight() / this._service.getItemHeight()),
            ChangesInitiator.HolderHeight,
        );
        const cursor = this._service.getCursor();
        this._frame.setTotal(this._service.getLen(), ChangesInitiator.Scrolling);
        this._frame.moveTo(cursor, ChangesInitiator.Scrolling);
        this._service.setFrame(this._frame.get());
    }

    public get(): SafeRange {
        return this._frame.get();
    }

    public moveTo(start: number, initiator: ChangesInitiator) {
        this._frame.moveTo(start, initiator);
    }

    public offsetTo(offsetPx: number, initiator: ChangesInitiator) {
        this._frame.offsetTo(Math.round(offsetPx / this._service.getItemHeight()), initiator);
    }

    public offsetToByRows(offsetRow: number, initiator: ChangesInitiator) {
        this._frame.offsetTo(offsetRow, initiator);
    }

    public onFrameChange(handler: (rows: Row[]) => void): Subscription {
        return this._subjects.change.subscribe(handler);
    }

    public onPositionChange(handler: (position: PositionEvent) => void): Subscription {
        return this._subjects.position.subscribe(handler);
    }
}
