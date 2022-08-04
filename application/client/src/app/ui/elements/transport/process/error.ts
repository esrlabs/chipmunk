import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl } from '@angular/forms';

export enum Field {
    command = 'command',
    cwd = 'cwd',
}

export enum Codes {
    NO_ERRORS = 'NO_ERRORS',
    REQUIRED = 'REQUIRED',
    INVALID = 'INVALID',
}

export class ErrorState implements ErrorStateMatcher {
    readonly _alias: Field;
    private _code: Codes = Codes.NO_ERRORS;

    constructor(alias: Field) {
        this._alias = alias;
    }

    public isErrorState(
        control: FormControl | null,
        // form: FormGroupDirective | NgForm | null,
    ): boolean {
        if (control === null) {
            return false;
        }
        if (this.isFieldRequired(control.value)) {
            this._code = Codes.REQUIRED;
        } else if (!this.isFieldValid(control.value)) {
            this._code = Codes.INVALID;
        } else {
            this._code = Codes.NO_ERRORS;
        }
        return this._code !== Codes.NO_ERRORS;
    }

    public isFieldValid(value: string): boolean {
        if (typeof value !== 'string') {
            return false;
        }
        switch (this._alias) {
            case Field.cwd:
            case Field.command:
                return value.trim() !== '';
        }
    }

    public isFieldRequired(value: string): boolean {
        if (typeof value !== 'string') {
            return true;
        }
        switch (this._alias) {
            case Field.cwd:
            case Field.command:
                return value.trim() === '';
        }
    }

    public getErrorCode(): Codes {
        return this._code;
    }

    public isValid(): boolean {
        return this._code === Codes.NO_ERRORS;
    }
}
