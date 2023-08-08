import { UntypedFormControl } from '@angular/forms';
import { Filter } from './filter';

import * as dom from '@ui/env/dom';

export class FilterInput {
    public control: UntypedFormControl = new UntypedFormControl();
    protected filter: Filter;

    constructor(filter: Filter) {
        this.filter = filter;
    }

    public isEmpty(): boolean {
        return this._safe().trim() === '';
    }

    public keyup(event: KeyboardEvent) {
        if (event.key === 'Escape' && this.filter.defaults().clearOnEscape()) {
            this.drop();
            return true;
        }
        if (event.key === 'Enter' && this.filter.defaults().clearOnEnter()) {
            this.filter.subjects.get().enter.emit(this._safe());
            this.drop();
            return true;
        }
        if (event.key === 'ArrowUp') {
            this.filter.subjects.get().up.emit();
            dom.stop(event);
            return false;
        }
        if (event.key === 'ArrowDown') {
            this.filter.subjects.get().down.emit();
            dom.stop(event);
            return false;
        }
        this.filter.subjects.get().change.emit(this._safe());
        return true;
    }

    public drop() {
        this.control.setValue('');
        this.filter.subjects.get().drop.emit();
        this.filter.subjects.get().change.emit('');
    }

    public set(value: string) {
        this.control.setValue(value);
        this.filter.subjects.get().change.emit(value);
    }

    public get(): string {
        return this._safe();
    }

    public onFocus() {
        this.filter.subjects.get().focus.emit();
    }

    public onBlur() {
        this.filter.subjects.get().blur.emit();
    }

    private _safe(): string {
        return typeof this.control.value !== 'string' ? '' : this.control.value;
    }
}
