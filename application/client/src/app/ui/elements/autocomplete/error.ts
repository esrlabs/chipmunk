import { ErrorStateMatcher } from '@angular/material/core';
import { Subject } from '@platform/env/subscription';
import { FormControl } from '@angular/forms';

export abstract class ErrorState extends ErrorStateMatcher {
    protected value: string = '';

    public override isErrorState(control: FormControl | null): boolean {
        if (control !== null) {
            const updated = this.value !== control.value;
            this.value = control.value;
            updated && this.validate();
        }
        return this.is();
    }

    abstract msg(): string;
    abstract is(): boolean;
    abstract observer(): Subject<void>;
    abstract validate(): void;
}

export class NullErrorState extends ErrorState {
    protected subject: Subject<void> = new Subject();

    public msg(): string {
        return '';
    }

    public is(): boolean {
        return false;
    }

    public observer(): Subject<void> {
        return this.subject;
    }

    public validate(): void {
        return undefined;
    }
}
