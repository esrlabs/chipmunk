import { IRange } from '@platform/types/range';
import { Subject, Subjects } from '@platform/env/subscription';

export class Cursor {
    public from: number = 0;
    public to: number = 0;
    public width: number = 1;
    public visible: boolean = false;
    // Length of stream
    public stream: number = 0;
    public subjects: Subjects<{
        position: Subject<void>;
        width: Subject<void>;
        visibility: Subject<void>;
    }> = new Subjects({
        position: new Subject(),
        width: new Subject(),
        visibility: new Subject<void>(),
    });

    protected visibility(): {
        update(): void;
    } {
        return {
            update: (): void => {
                const prev = this.visible;
                this.visible = this.width !== 1 && this.width < this.stream;
                if (!this.visible) {
                    this.from = 0;
                    this.to = this.stream - 1;
                }
                this.visible !== prev && this.subjects.get().visibility.emit();
            },
        };
    }

    public destroy() {
        this.subjects.destroy();
    }

    public setFrame(frame: IRange) {
        if (frame.from < 0 || frame.to < 0 || frame.from > frame.to) {
            throw new Error(`Invalid cursor`);
        }
        this.from = frame.from;
        this.to = frame.to;
        this.subjects.get().position.emit();
    }

    public setStream(len: number) {
        this.stream = len;
        this.visibility().update();
    }

    public setWidth(width: number) {
        if (width < 0) {
            throw new Error(`Invalid width`);
        }
        this.width = width;
        this.visibility().update();
        this.subjects.get().width.emit();
    }

    public getFrame(): IRange | undefined {
        if (this.from < 0 || this.to < 0 || this.from > this.to) {
            return undefined;
        }
        return { from: this.from, to: this.to };
    }

    public getWidth(): number {
        return this.width;
    }

    public hash(): string {
        return `${this.from};${this.to};${this.width}`;
    }
}
