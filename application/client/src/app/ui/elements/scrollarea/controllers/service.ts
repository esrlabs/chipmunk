import { Row } from '@schema/content/row';
import { Range } from './range';
import { Subject, Subscription } from '@platform/env/subscription';
import { IRange, Range as SafeRange } from '@platform/types/range';
import { Destroy } from '@platform/types/env/types';
import { ChangesInitiator, Frame } from './frame';

export { Range };

export interface IRowsPacket {
    range: IRange;
    rows: Row[];
}

export type CursorCorrectorHandler = () => number;

export class Service implements Destroy {
    public readonly setFrame: (range: SafeRange) => void;
    public readonly getLen: () => number;
    public readonly getItemHeight: () => number;
    public readonly getRows: (range: IRange) => Promise<IRowsPacket>;

    protected frame!: Frame;
    protected elRef!: HTMLElement;

    private _focus: boolean = false;
    private readonly _subjects: {
        rows: Subject<IRowsPacket>;
        refresh: Subject<void>;
        len: Subject<number>;
        bound: Subject<void>;
        focus: Subject<void>;
        blur: Subject<void>;
    } = {
        rows: new Subject(),
        refresh: new Subject(),
        len: new Subject(),
        bound: new Subject(),
        focus: new Subject(),
        blur: new Subject(),
    };
    private _cursor: number = 0;

    constructor(api: {
        setFrame(range: IRange): void;
        getRows(range: IRange): Promise<IRowsPacket>;
        getLen(): number;
        getItemHeight(): number;
    }) {
        this.setFrame = (range: SafeRange) => {
            api.setFrame(range);
            this._cursor = range.from;
        };
        this.getLen = api.getLen;
        this.getItemHeight = api.getItemHeight;
        this.getRows = api.getRows;
    }

    public bind(frame: Frame, elRef: HTMLElement) {
        this.frame = frame;
        this.elRef = elRef;
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
        this._subjects.focus.destroy();
        this._subjects.blur.destroy();
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

    public onFocus(handler: () => void): Subscription {
        return this._subjects.focus.subscribe(handler);
    }

    public onBlur(handler: () => void): Subscription {
        return this._subjects.blur.subscribe(handler);
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
        set(): void;
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
                this._subjects.focus.emit();
            },
            out: (): void => {
                if (!this._focus) {
                    return;
                }
                this._focus = false;
                this._subjects.blur.emit();
            },
            set: (): void => {
                this.elRef !== undefined && this.elRef.focus();
            },
        };
    }
}
