import { ErrorStateMatcher } from '@angular/material/core';
import { UntypedFormControl } from '@angular/forms';
import { ISettingsEntry } from '@platform/types/settings/entry';
import { Validator } from '../validator';

export enum Codes {
    NO_ERRORS = 'NO_ERRORS',
    REQUIRED = 'REQUIRED',
    INVALID = 'INVALID',
}

export class ErrorState implements ErrorStateMatcher {
    protected readonly entry: ISettingsEntry;
    protected readonly validator: Validator<string>;
    protected readonly update: () => void;
    protected checked: string | undefined;

    public error: string | undefined;

    constructor(entry: ISettingsEntry, validator: Validator<string>, update: () => void) {
        this.entry = entry;
        this.validator = validator;
        this.update = update;
    }

    public isErrorState(
        control: UntypedFormControl | null,
        //form: FormGroupDirective | NgForm | null,
    ): boolean {
        if (control === null) {
            return false;
        }
        if (this.checked === control.value) {
            return this.error !== undefined;
        }
        this.checked = control.value;
        if (this.isFieldRequired(control.value)) {
            this.error = `Required`;
        } else {
            this.validator
                .validate(this.entry.desc.path, this.entry.desc.key, control.value)
                .then((error: string | undefined) => {
                    this.error = error;
                })
                .catch((err: Error) => {
                    this.error = err.message;
                })
                .finally(() => {
                    this.update();
                });
        }
        return this.error !== undefined;
    }

    public isFieldRequired(value: string): boolean {
        if (typeof value !== 'string') {
            return !this.entry.desc.allowEmpty;
        }
        if (this.entry.desc.allowEmpty) {
            return false;
        }
        return value.trim() === '';
    }
}
