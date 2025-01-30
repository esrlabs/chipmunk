import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { cutUuid } from '@log/index';
import { RowSrc, Owner, Row } from '@schema/content/row';
import { IRange } from '@platform/types/range';

export interface SelectEvent {
    row: number;
    initiator: Owner;
}

@SetupLogger()
export class Cursor extends Subscriber {
    public readonly subjects: Subjects<{
        selected: Subject<SelectEvent>;
        updated: Subject<void>;
        loaded: Subject<void>;
        frame: Subject<IRange>;
    }> = new Subjects({
        selected: new Subject<SelectEvent>(),
        updated: new Subject<void>(),
        loaded: new Subject<void>(),
        frame: new Subject<IRange>(),
    });
    private _selected: number[] = [];
    private _uuid!: string;
    private _last: {
        position: number | undefined;
        row: RowSrc | undefined;
        recent: RowSrc[];
    } = {
        position: undefined,
        row: undefined,
        recent: [],
    };
    private _frame: IRange | undefined;

    public init(uuid: string) {
        this.setLoggerName(`Cursor: ${cutUuid(uuid)}`);
        this._uuid = uuid;
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
    }

    public recent(rows: RowSrc[]) {
        this._last.recent = rows;
        this.subjects.get().loaded.emit();
    }

    public frame(): {
        set(frame: IRange): void;
        get(): IRange | undefined;
    } {
        return {
            set: (frame: IRange): void => {
                this._frame = frame;
                this.subjects.get().frame.emit(frame);
            },
            get: (): IRange | undefined => {
                return Object.assign({}, this._frame);
            },
        };
    }

    public select(
        position: number,
        initiator: Owner,
        event: PointerEvent | undefined,
        row: Row | undefined,
    ) {
        if (event !== undefined && event.shiftKey) {
            if (this._selected.length === 0) {
                this._selected = [position];
            } else {
                const last = this._selected[this._selected.length - 1];
                if (last === position) {
                    return;
                }
                this._selected = this._selected.concat(
                    [...new Array(Math.abs(position - last))].map((_, i) =>
                        position < last ? i + position : last + i + 1,
                    ),
                );
            }
        } else if (event !== undefined && (event.ctrlKey || event.metaKey)) {
            const target = this._selected.indexOf(position);
            if (target === -1) {
                this._selected.push(position);
            } else {
                this._selected.splice(target, 1);
            }
        } else if (this._selected.length === 1 && this._selected[0] === position) {
            this._selected = [];
        } else {
            this._selected = [position];
        }
        this._last.position = position;
        this._last.row = row !== undefined ? row.serialized() : undefined;
        this.subjects.get().selected.emit({
            row: position,
            initiator,
        });
        this.subjects.get().updated.emit();
    }

    public mark(row: number): {
        selected(): void;
        unselected(): void;
    } {
        return {
            selected: (): void => {
                if (this.isSelected(row)) {
                    return;
                }
                this._selected.push(row);
                this.subjects.get().updated.emit();
            },
            unselected: (): void => {
                this._selected = this._selected.filter((r) => r !== row);
                this.subjects.get().updated.emit();
            },
        };
    }

    public isSelected(row: number): boolean {
        return this._selected.find((r) => r === row) !== undefined;
    }

    public get(): number[] {
        return this._selected;
    }

    public getSingle(): {
        position(): number | undefined;
        row(): RowSrc | undefined;
    } {
        return {
            position: (): number | undefined => {
                return this._selected.length === 1 ? this._last.position : undefined;
            },
            row: (): RowSrc | undefined => {
                if (this._selected.length !== 1) {
                    return undefined;
                }
                return this._last.row !== undefined
                    ? this._last.row
                    : this._last.recent.find((r) => r.position === this._last.position);
            },
        };
    }

    public drop(): Cursor {
        this._selected = [];
        this.subjects.get().updated.emit();
        return this;
    }
}
export interface Cursor extends LoggerInterface {}
