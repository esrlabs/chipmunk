import { InternalAPI } from '@service/ilc';
import { Subject, Subjects } from '@platform/env/subscription';
import { syncHasFocusedInput } from '@ui/env/globals';
import { unique } from '@platform/env/sequence';
import { filters } from '@ui/service/filters';

export type Handler = () => void;

export class Filter {
    private _filter: string = '';
    private readonly _ilc: InternalAPI;
    private readonly _uuid: string = unique();

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
        filters.add(this._uuid);
        this.keyboard = this.keyboard.bind(this);
    }

    public destroy() {
        this.unbind();
        filters.remove(this._uuid);
    }

    public bind(): Filter {
        window.addEventListener('keyup', this.keyboard);
        return this;
    }

    public unbind(): Filter {
        window.removeEventListener('keyup', this.keyboard);
        return this;
    }

    public keyboard(event: KeyboardEvent): boolean {
        if (!filters.isEnabled(this._uuid)) {
            return false;
        }
        if (syncHasFocusedInput()) {
            return false;
        }
        if (this._ilc.services.system.state.states().ui.input) {
            return false;
        }
        if (event.ctrlKey || event.metaKey || event.altKey) {
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
    public uuid(): string {
        return this._uuid;
    }
}
