import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { cutUuid } from '@log/index';
import { Owner } from '@schema/content/row';
import { Row } from '@schema/content/row';

export interface SelectEvent {
    row: number;
    initiator: Owner;
}

export enum HoldKey {
    ctrl = 0,
    shift = 1,
}

@SetupLogger()
export class Cursor extends Subscriber {
    public readonly subjects: Subjects<{
        selected: Subject<SelectEvent>;
        updated: Subject<void>;
    }> = new Subjects({
        selected: new Subject<SelectEvent>(),
        updated: new Subject<void>(),
    });
    private _selected: number[] = [];
    private _uuid!: string;
    private _hold: HoldKey | undefined;
    private _last: Row | undefined;

    public init(uuid: string) {
        this.setLoggerName(`Cursor: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        // TODO: use here global listener @ui/services/listener
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }

    public select(row: Row, initiator: Owner) {
        if (this._hold === undefined) {
            if (this._selected.length === 1 && this._selected[0] === row.position.stream) {
                this._selected = [];
            } else {
                this._selected = [row.position.stream];
            }
        } else if (this._hold === HoldKey.shift) {
            if (this._selected.length === 0) {
                this._selected = [row.position.stream];
            } else {
                const last = this._selected[this._selected.length - 1];
                if (last === row.position.stream) {
                    return;
                }
                this._selected = this._selected.concat(
                    [...new Array(Math.abs(row.position.stream - last))].map((_, i) =>
                        row.position.stream < last ? i + row.position.stream : last + i + 1,
                    ),
                );
            }
        } else if (this._hold === HoldKey.ctrl) {
            const target = this._selected.indexOf(row.position.stream);
            if (target === -1) {
                this._selected.push(row.position.stream);
            } else {
                this._selected.splice(target, 1);
            }
        }
        this._last = row;
        this.subjects.get().selected.emit({
            row: row.position.stream,
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

    public getSingle(): Row | undefined {
        return this._selected.length === 1 ? this._last : undefined;
    }

    public drop() {
        this._selected = [];
        this.subjects.get().updated.emit();
    }

    private _onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Shift') {
            this._hold = HoldKey.shift;
        } else if (event.key === 'Control') {
            this._hold = HoldKey.ctrl;
        } else {
            this._hold = undefined;
        }
    }

    private _onKeyUp() {
        this._hold = undefined;
    }
}
export interface Cursor extends LoggerInterface {}
