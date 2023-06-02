import { Subscription, Subject } from '@platform/env/subscription';
import { IRange, Range as SafeRange } from '@platform/types/range';
import { ChangesInitiator } from './frame';
import { LimittedRange } from '@ui/env/entities/range.limited';

export class Range {
    private range: LimittedRange = new LimittedRange('scroll_area_range', 0, 0, 0, 0, true);
    private readonly _subjects: {
        change: Subject<ChangesInitiator>;
    } = {
        change: new Subject<ChangesInitiator>(),
    };
    constructor(defaults?: { range: IRange; len: number; total: number }) {
        if (defaults !== undefined) {
            this.range
                .$(defaults.total)
                .max()
                .$(defaults.len)
                .len()
                .$(defaults.range.from)
                .from()
                .$(defaults.range.to)
                .to();
        }
    }

    public destroy() {
        this._subjects.change.destroy();
    }

    public setLength(len: number, initiator: ChangesInitiator) {
        const prev = this.range.hash();
        this.range.$(len).len();
        if (prev !== this.range.hash()) {
            this._subjects.change.emit(initiator);
        }
    }

    public getLength(): number {
        return this.range.len;
    }

    public getTotal(): number {
        return this.range.max;
    }

    public setTotal(total: number, initiator: ChangesInitiator) {
        const prev = this.range.hash();
        this.range.$(total).max();
        if (prev !== this.range.hash()) {
            this._subjects.change.emit(initiator);
        }
    }

    public moveTo(from: number, initiator: ChangesInitiator) {
        const prev = this.range.hash();
        if (from > this.range.max) {
            throw new Error(`Fail to move cursor outside of available data`);
        }
        this.range.$(from).from();
        if (prev !== this.range.hash()) {
            this._subjects.change.emit(initiator);
        }
    }

    public offsetTo(offset: number, initiator: ChangesInitiator) {
        const prev = this.range.hash();
        if (offset < 0) {
            this.range.$(this.range.from + offset).from();
        } else {
            this.range.$(this.range.from + offset + this.range.len).to();
        }
        if (prev !== this.range.hash()) {
            this._subjects.change.emit(initiator);
        }
    }

    public refresh(initiator: ChangesInitiator) {
        this._subjects.change.emit(initiator);
    }

    public get(): SafeRange {
        return new SafeRange(this.range.from, this.range.to);
    }

    public equal(range: IRange): boolean {
        return this.range.from === range.from && this.range.to === range.to;
    }

    public onChange(handler: (ci: ChangesInitiator) => void): Subscription {
        return this._subjects.change.subscribe(handler);
    }
}
