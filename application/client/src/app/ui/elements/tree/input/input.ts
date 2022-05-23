import { FormControl } from '@angular/forms';
import { Subject } from '@platform/env/subscription';

export class FavouriteInput {
    public control: FormControl = new FormControl();
    public ref!: HTMLInputElement;
    public value: string = '';
    public readonly: boolean = false;
    public focused: boolean = false;
    public actions: {
        clear: Subject<void>;
        accept: Subject<string>;
    } = {
        clear: new Subject(),
        accept: new Subject(),
    };

    public destroy() {
        this.actions.clear.destroy();
        this.actions.accept.destroy();
    }

    public isEmpty(): boolean {
        return this.value.trim() === '';
    }

    public keyup(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            if (this.control.value.trim() !== '') {
                this.drop();
                this.actions.clear.emit();
            }
        } else if (event.key === 'Enter') {
            if (this.control.value.trim() === '') {
                return;
            }
            this.value = this.control.value;
            this.actions.accept.emit(this.value);
            this.drop();
        }
    }

    public drop() {
        this.control.setValue('');
        this.value = '';
    }

    public set(value: string) {
        this.control.setValue(value);
    }
}
