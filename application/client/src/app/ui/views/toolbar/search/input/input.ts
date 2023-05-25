import { UntypedFormControl } from '@angular/forms';
import { Subject } from '@platform/env/subscription';
import { IFilter, IFilterFlags } from '@platform/types/filter';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { ErrorHandler } from './error';

import * as obj from '@platform/env/obj';

export class SearchInput {
    public readonly control: UntypedFormControl = new UntypedFormControl();
    public readonly error: ErrorHandler = new ErrorHandler();
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
        accept: Subject<void>;
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
        this.actions.edit.destroy();
        this.actions.clear.destroy();
        this.error.destroy();
    }

    public bind(ref: HTMLInputElement, panel: MatAutocompleteTrigger) {
        this.control.setValue('');
        this.ref = ref;
        this._panel = panel;
    }

    public focus() {
        this.ref.focus();
    }

    public blur() {
        this.ref.blur();
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

    public getNonActive(): IFilter {
        return {
            filter: this.control.value,
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
            this.blur();
        } else if (event.key === 'Enter') {
            if (this.recent) {
                this.recent = false;
                this._panel.closePanel();
            }
            if (this.control.value.trim() === '') {
                this.drop();
                this.actions.accept.emit();
            } else {
                this.value = this.control.value;
                this.error.set().value(this.control.value);
                !this.error.hasError() && this.actions.accept.emit();
            }
        } else if (event.key === 'Backspace' && this.control.value === '' && this._prev === '') {
            this.actions.edit.emit();
        } else if (
            (this.control.value !== '' || event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
            !this.recent
        ) {
            this.recent = true;
            this._panel.openPanel();
            this.actions.recent.emit();
        }
        this.error.set().value(this.control.value);
    }

    public drop() {
        this.control.setValue('');
        this.error.set().value(this.control.value);
        this.value = '';
        this._prev = '';
    }

    public set(): {
        value(value: string | IFilter): void;
        caseSensitive(): void;
        wholeWord(): void;
        regex(): void;
    } {
        return {
            value: (value: string | IFilter): void => {
                if (typeof value === 'string') {
                    this.control.setValue(value);
                    this._prev = value;
                } else {
                    this.control.setValue(value.filter);
                    this.flags = obj.clone(value.flags);
                }
                this.error.set().value(this.control.value);
            },
            caseSensitive: () => {
                this.flags.cases = !this.flags.cases;
                this.error.set().caseSensitive(this.flags.cases);
            },
            wholeWord: () => {
                this.flags.word = !this.flags.word;
                this.error.set().wholeWord(this.flags.word);
            },
            regex: () => {
                if (!this.flags.reg && !this.error.isValidRegex()) {
                    return;
                }
                this.flags.reg = !this.flags.reg;
                this.error.set().regex(this.flags.reg);
            },
        };
    }

    public onPanelClosed() {
        this.recent = false;
    }
}
