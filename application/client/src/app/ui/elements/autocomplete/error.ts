import { ErrorStateMatcher } from '@angular/material/core';
import { Subject } from '@platform/env/subscription';
import { UntypedFormControl } from '@angular/forms';

export abstract class ErrorState extends ErrorStateMatcher {
    protected value: string = '';
    protected timer: number = -1;
    public override isErrorState(control: UntypedFormControl | null): boolean {
        if (control !== null) {
            const updated = this.value !== control.value;
            this.value = control.value;
            updated && this.check();
        }
        return this.is();
    }

    abstract msg(): string;
    abstract is(): boolean;
    abstract observer(): Subject<void>;
    abstract validate(): void;

    public check() {
        // We are using timeout to prevent ExpressionChangedAfterItHasBeenCheckedError
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.validate();
        }) as unknown as number;
    }
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
