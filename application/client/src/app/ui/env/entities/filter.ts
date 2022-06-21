import { InternalAPI } from '@service/ilc';
import { Subject, Subjects } from '@platform/env/subscription';

export type Handler = () => void;

export class Filter {
    private _filter: string = '';
    private _ilc: InternalAPI;
    public readonly subjects: Subjects<{
        change: Subject<string>;
        drop: Subject<void>;
    }> = new Subjects({
        change: new Subject<string>(),
        drop: new Subject<void>(),
    });

    constructor(ilc: InternalAPI) {
        this._ilc = ilc;
        this._ilc.channel.ui.input.focused(() => {
            this.drop();
        });
    }

    public keyboard(event: KeyboardEvent): boolean {
        if (this._ilc.services.system.state.states().ui.input) {
            return false;
        }
        if (event.code === 'Backspace') {
            if (this._filter.length > 0) {
                this._filter = this._filter.substring(0, this._filter.length - 1);
                this.subjects.get().change.emit(this._filter);
                return true;
            }
        } else if (event.code === 'Escape' || event.code === 'Enter') {
            if (this._filter !== '') {
                this.drop();
                return true;
            }
        } else if (event.key.length === 1 && this._filter.length < 50) {
            this._filter += event.key;
            if (this._filter.trim() === '') {
                this.drop();
            } else {
                this.subjects.get().change.emit(this._filter);
            }
            return true;
        }
        return false;
    }
    public isEmpty(): boolean {
        return this._filter.trim() === '';
    }
    public value(): string {
        return this._filter;
    }
    public drop(): boolean {
        if (this._filter === '') {
            return false;
        }
        this._filter = '';
        this.subjects.get().drop.emit();
        return true;
    }
}
