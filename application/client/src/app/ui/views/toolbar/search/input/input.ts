import { FormControl } from '@angular/forms';
import { Subject } from '@platform/env/subscription';
import { IFilter, IFilterFlags } from '@platform/types/filter';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';

import * as obj from '@platform/env/obj';

export class SearchInput {
    public control: FormControl = new FormControl();
    public ref!: HTMLInputElement;
    public value: string = '';
    public readonly: boolean = false;
    public focused: boolean = false;
    public recent: boolean = false;
    public flags: IFilterFlags = {
        word: false,
        cases: false,
        reg: true,
    };
    public actions: {
        drop: Subject<void>;
        clear: Subject<void>;
        accept: Subject<string>;
        recent: Subject<void>;
        edit: Subject<void>;
    } = {
        drop: new Subject(),
        clear: new Subject(),
        accept: new Subject(),
        recent: new Subject(),
        edit: new Subject(),
    };
    private _prev: string = '';
    private _panel!: MatAutocompleteTrigger;

    public destroy() {
        this.actions.accept.destroy();
        this.actions.drop.destroy();
        this.actions.recent.destroy();
    }

    public bind(ref: HTMLInputElement, panel: MatAutocompleteTrigger) {
        this.ref = ref;
        this._panel = panel;
    }

    public isEmpty(): boolean {
        return this.value.trim() === '';
    }

    public asFilter(): IFilter {
        return {
            filter: this.value,
            flags: this.flags,
        };
    }

    public keydown() {
        this._prev = this.control.value;
    }

    public keyup(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            this.recent = false;
            if (this.control.value.trim() !== '') {
                this.drop();
                this.actions.clear.emit();
            } else {
                this.actions.drop.emit();
            }
        } else if (event.key === 'Enter') {
            if (this.recent) {
                this.recent = false;
                this._panel.closePanel();
            }
            if (this.control.value.trim() === '') {
                this.drop();
                this.actions.drop.emit();
            } else {
                this.value = this.control.value;
                this.actions.accept.emit(this.value);
            }
        } else if (event.key === 'Backspace' && this.control.value === '' && this._prev === '') {
            this.actions.edit.emit();
        } else if (this.control.value !== '' && !this.recent) {
            this.recent = true;
            this._panel.openPanel();
            this.actions.recent.emit();
        }
    }

    public drop() {
        this.control.setValue('');
        this.value = '';
        this._prev = '';
    }

    public set(value: string | IFilter) {
        if (typeof value === 'string') {
            this.control.setValue(value);
            this._prev = value;
        } else {
            this.control.setValue(value.filter);
            this.flags = obj.clone(value.flags);
        }
    }

    public onPanelClosed() {
        this.recent = false;
    }
}
