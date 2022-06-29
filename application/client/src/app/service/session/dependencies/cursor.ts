import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { cutUuid } from '@log/index';
import { Owner } from '@schema/content/row';

export interface SelectEvent {
    row: number;
    initiator: Owner;
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

    public init(uuid: string) {
        this.setLoggerName(`Cursor: ${cutUuid(uuid)}`);
        this._uuid = uuid;
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
    }

    public select(row: number, initiator: Owner) {
        this._selected = [row];
        this.subjects.get().selected.emit({
            row,
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
}
export interface Cursor extends LoggerInterface {}
