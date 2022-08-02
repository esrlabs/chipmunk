import { FormControl } from '@angular/forms';
import { Subject } from '@platform/env/subscription';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';

export class Controll {
    public control: FormControl = new FormControl();
    public ref!: HTMLInputElement;
    public value: string = '';
    public readonly: boolean = false;
    public focused: boolean = false;
    public recent: boolean = false;

    public actions: {
        edit: Subject<string>;
        recent: Subject<void>;
    } = {
        edit: new Subject(),
        recent: new Subject(),
    };
    private _panel!: MatAutocompleteTrigger;

    public destroy() {
        this.actions.edit.destroy();
        this.actions.recent.destroy();
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
            }
        } else if (this.control.value !== '' && !this.recent) {
            this.recent = true;
            this._panel.openPanel();
            this.actions.recent.emit();
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
    }

    public onPanelClosed() {
        this.recent = false;
    }
}
