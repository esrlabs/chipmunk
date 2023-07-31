import { Subject, Subjects } from '@platform/env/subscription';

const DEFAULT_CAPTION = 'Run';
const DEFAULT_STATE = false;

export class Action {
    public subjects: Subjects<{
        updated: Subject<void>;
        apply: Subject<void>;
        applied: Subject<void>;
    }> = new Subjects({
        updated: new Subject<void>(),
        apply: new Subject<void>(),
        applied: new Subject<void>(),
    });

    public caption: string = DEFAULT_CAPTION;
    public disabled: boolean = DEFAULT_STATE;

    public destroy(): void {
        this.subjects.destroy();
    }

    public setCaption(caption: string): void {
        this.caption = caption;
        this.subjects.get().updated.emit();
    }

    public setDisabled(disabled: boolean): void {
        if (this.disabled === disabled) {
            return;
        }
        this.disabled = disabled;
        this.subjects.get().updated.emit();
    }

    public defaults(): void {
        this.caption = DEFAULT_CAPTION;
        this.disabled = DEFAULT_STATE;
        this.subjects.get().updated.emit();
    }

    public apply(): void {
        this.subjects.get().apply.emit();
    }

    public applied(): void {
        this.subjects.get().applied.emit();
    }
}
