import { ErrorStateMatcher } from '@angular/material/core';
import { Subject } from '@platform/env/subscription';
import { UntypedFormControl } from '@angular/forms';
import { bridge } from '@service/bridge';
import { scope } from '@platform/env/scope';

export class ErrorState extends ErrorStateMatcher {
    public subject: Subject<void> = new Subject();
    protected exist: boolean = false;
    protected value: string = '';

    public override isErrorState(control: UntypedFormControl | null): boolean {
        if (control !== null && typeof control.value === 'string') {
            const updated = this.value !== control.value;
            this.value = control.value;
            updated &&
                this.check().catch((err: Error) => {
                    scope
                        .getLogger(`ErrorState (FolderInput)`)
                        .error(`Fail to check path: ${err.message}`);
                });
        }
        return this.is();
    }

    public is(): boolean {
        return !this.exist;
    }

    public async check(): Promise<void> {
        if (this.value.trim() === '') {
            this.exist = false;
        } else {
            this.exist = await bridge.files().exists(this.value);
        }
        this.subject.emit();
    }
}
