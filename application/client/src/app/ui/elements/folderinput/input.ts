import { UntypedFormControl } from '@angular/forms';
import { Subject } from '@platform/env/subscription';
import {
    MatAutocompleteTrigger,
    MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';

export class Controll {
    public control: UntypedFormControl = new UntypedFormControl();
    public ref!: HTMLInputElement;
    public value: string = '';
    public readonly: boolean = false;
    public focused: boolean = false;
    public recent: boolean = false;

    public actions: {
        edit: Subject<string>;
        enter: Subject<string>;
        panel: Subject<boolean>;
    } = {
        edit: new Subject(),
        enter: new Subject(),
        panel: new Subject(),
    };
    private _panel!: MatAutocompleteTrigger;

    public destroy() {
        this.actions.enter.destroy();
        this.actions.edit.destroy();
        this.actions.panel.destroy();
    }

    public bind(ref: HTMLInputElement, panel: MatAutocompleteTrigger) {
        this.ref = ref;
        this._panel = panel;
    }

    public isEmpty(): boolean {
        return this.value.trim() === '';
    }

    public keyup(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            this.recent = false;
            if (this.control.value.trim() !== '') {
                this.drop();
            }
        } else if (event.key === 'Enter') {
            if (this.recent) {
                this.recent = false;
                this._panel.closePanel();
                this.actions.panel.emit(false);
            }
            this.actions.enter.emit(this.value);
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            if (!this.recent) {
                this.recent = true;
                this._panel.openPanel();
                this.actions.panel.emit(true);
            }
        } else if (this.control.value !== '' && !this.recent) {
            this.recent = true;
            this._panel.openPanel();
            this.actions.panel.emit(true);
        }
        this.value = this.control.value;
        this.actions.edit.emit(this.value);
    }

    public drop() {
        this.control.setValue('');
        this.value = '';
    }

    public set(value: string) {
        this.control.setValue(value);
        this.value = this.control.value;
        this.actions.edit.emit(this.value);
    }

    public onPanelClosed() {
        this.recent = false;
    }

    public selected(event: MatAutocompleteSelectedEvent) {
        this.set(event.option.value);
    }

    public disable(): void {
        this.control.disable();
    }

    public enable(): void {
        this.control.enable();
    }
}
