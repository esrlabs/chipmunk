import { Subject } from '@platform/env/subscription';
import { IRange } from '@platform/types/range';
import { Session } from '@service/session';

const MIN_CURSOR_WIDTH = 16;

export class Cursor {
    public updated: Subject<void> = new Subject();

    public stream: number = 0;
    public from: number = 0;
    public to: number = 0;
    public left: number = 0;
    public right: number = 0;
    public leftPx: string = '0px';
    public rightPx: string = '0px';
    public width: number = 0;
    public visible: boolean = false;

    protected session!: Session;

    public init(session: Session) {
        this.session = session;
        this.setStreamLen(this.session.stream.len());
    }

    public destroy() {
        this.updated.destroy();
    }

    public asRange(): IRange | undefined {
        if (!this.visible) {
            return undefined;
        }
        return { from: this.from, to: this.to };
    }

    public setStreamLen(len: number): void {
        if (this.stream === this.to && this.from === 0) {
            this.to = len;
        }
        this.stream = len;
        this.update().frame();
    }

    public setWidth(width: number): void {
        if (this.width === width) {
            return;
        }
        this.width = width;
        this.session.charts.cursor.setWidth(this.width);
        this.update().frame();
    }

    public fromPx(left: number, width: number): void {
        if (width < MIN_CURSOR_WIDTH) {
            width = MIN_CURSOR_WIDTH;
        }
        if (left < 0) {
            left = 0;
        }
        if (left + width > this.width) {
            left = this.width - width;
        }
        this.left = left;
        this.right = this.width - left - width;
        this.update().coors();
    }

    public change(diff: number): {
        left(): void;
        right(): void;
        resize(): void;
        move(): void;
    } {
        const safeLeft = (left: number): number => {
            const max = this.width - this.right - MIN_CURSOR_WIDTH;
            if (left > max) {
                left = max;
            }
            if (left < 0) {
                left = 0;
            }
            return left;
        };
        const safeRight = (right: number): number => {
            const max = this.width - this.left - MIN_CURSOR_WIDTH;
            if (right > max) {
                right = max;
            }
            if (right < 0) {
                right = 0;
            }
            return right;
        };
        return {
            left: (): void => {
                this.left = safeLeft(this.left + diff);
                this.update().coors();
            },
            right: (): void => {
                this.right = safeRight(this.right - diff);
                this.update().coors();
            },
            resize: (): void => {
                const lSide = Math.round(diff / 2);
                this.left = safeLeft(this.left + lSide);
                const rSide = diff - lSide;
                this.right = safeRight(this.right + rSide);
                this.update().coors();
            },
            move: (): void => {
                const width = this.width - this.left - this.right;
                let left = this.left + diff;
                if (left < 0) {
                    left = 0;
                }
                if (left + width > this.width) {
                    left = this.width - width;
                }
                this.left = left;
                this.right = this.width - left - width;
                this.update().coors();
            },
        };
    }

    public rowsRangeByX(x: number): IRange {
        const frame = this.to - this.from;
        const rate = this.width / frame;
        if (rate < 1) {
            const from = Math.floor(x / rate) + this.from;
            return { from, to: from + Math.floor(frame / this.width) };
        } else {
            const from = Math.floor(x / rate);
            return { from, to: from };
        }
    }

    protected update(): {
        coors(): void;
        frame(): void;
        notify(): void;
    } {
        const getRate = (): number | undefined => {
            if (this.stream === 0) {
                this.to = 0;
                this.from = 0;
                this.left = 0;
                this.right = 0;
                this.visible = false;
                return undefined;
            }
            const rate = this.width / this.stream;
            this.visible = rate < 1;
            return rate > 1 ? undefined : rate;
        };
        return {
            coors: (): void => {
                const rate = getRate();
                if (rate === undefined) {
                    return;
                }
                const from = Math.floor(this.left / rate);
                const to = Math.floor((this.width - this.right) / rate);
                this.from = from > 0 ? (from > this.stream ? this.stream : from) : 0;
                this.to = to > 0 ? (to > this.stream ? this.stream : to) : 0;
                this.update().notify();
            },
            frame: (): void => {
                const rate = getRate();
                if (rate === undefined) {
                    return;
                }
                this.left = Math.floor(this.from * rate);
                this.right = this.width - Math.floor(this.to * rate);
                this.update().notify();
            },
            notify: (): void => {
                if (this.visible) {
                    this.leftPx = `${this.left}px`;
                    this.rightPx = `${this.right}px`;
                }
                this.updated.emit();
                const frame = this.asRange();
                frame !== undefined && this.session.charts.cursor.setFrame(frame);
            },
        };
    }
}
