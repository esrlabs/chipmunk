import { Row } from '@schema/content/row';
import { Range } from './range';
import { Subject, Subscription } from '@platform/env/subscription';
import { IRange, Range as SafeRange } from '@platform/types/range';
import { Destroy } from '@env/declarations';
import { ChangesInitiator, Frame } from './frame';

export { Range };

export interface IRowsPacket {
    range: IRange;
    rows: Row[];
}

export type CursorCorrectorHandler = () => number;

// export interface IAPI {
//     setFrame: (range: IRange) => void;
//     getStorageInfo: () => IStorageInformation;
//     getItemHeight: () => number;
//     onStorageUpdated: Observable<IStorageInformation>;
//     onScrollTo: Subject<number>;
//     onScrollUntil: Subject<number>;
//     onRows: Observable<IRowsPacket>;
//     onSourceUpdated: Subject<void>;
//     onRerequest: Subject<void>;
//     onRedraw: Subject<void>;
// }

export class Service implements Destroy {
    public readonly setFrame: (range: SafeRange) => void;
    public readonly getLen: () => number;
    public readonly getItemHeight: () => number;

    protected frame!: Frame;

    private _focus: boolean = false;
    private readonly _subjects: {
        rows: Subject<IRowsPacket>;
        refresh: Subject<void>;
        len: Subject<number>;
        bound: Subject<void>;
    } = {
        rows: new Subject(),
        refresh: new Subject(),
        len: new Subject(),
        bound: new Subject(),
    };
    private _cursor: number = 0;

    constructor(api: {
        setFrame(
            range: IRange,
            cursor: number,
            setCursor: (value: number) => void,
            getFrameLength: () => number,
        ): void;
        getLen(): number;
        getItemHeight(): number;
    }) {
        this.setFrame = (range: SafeRange) => {
            api.setFrame(
                range,
                this._cursor,
                (value: number) => {
                    this._cursor = value;
                },
                () => {
                    return this.frame.getFrameLen();
                },
            );
            this._cursor = range.from;
        };
        this.getLen = api.getLen;
        this.getItemHeight = api.getItemHeight;
    }

    public bind(frame: Frame) {
        this.frame = frame;
        this._subjects.bound.emit();
    }

    public getFrame(): Frame {
        return this.frame;
    }

    public destroy() {
        this._subjects.rows.destroy();
        this._subjects.len.destroy();
        this._subjects.refresh.destroy();
        this._subjects.bound.destroy();
    }

    public setLen(len: number) {
        this._subjects.len.emit(len);
    }

    public scrollTo(position: number) {
        this.frame.moveTo(position, ChangesInitiator.Selecting);
    }

    public scrollToBottom() {
        this.frame.moveTo(this.getLen() - 1, ChangesInitiator.Selecting);
    }

    public scrollToTop() {
        this.frame.moveTo(0, ChangesInitiator.Selecting);
    }

    public setRows(rows: IRowsPacket) {
        this._subjects.rows.emit(rows);
    }

    public onRows(handler: (rows: IRowsPacket) => void): Subscription {
        return this._subjects.rows.subscribe(handler);
    }

    public onBound(handler: () => void): Subscription {
        return this._subjects.bound.subscribe(handler);
    }

    public onLen(handler: (len: number) => void): Subscription {
        return this._subjects.len.subscribe(handler);
    }

    public onRefresh(handler: () => void): Subscription {
        return this._subjects.refresh.subscribe(handler);
    }

    public getCursor(): number {
        return this._cursor;
    }

    public refresh(): void {
        this._subjects.refresh.emit();
    }

    public focus(): {
        get(): boolean;
        in(): void;
        out(): void;
    } {
        return {
            get: (): boolean => {
                return this._focus;
            },
            in: (): void => {
                if (this._focus) {
                    return;
                }
                this._focus = true;
            },
            out: (): void => {
                if (!this._focus) {
                    return;
                }
                this._focus = false;
            },
        };
    }
}
