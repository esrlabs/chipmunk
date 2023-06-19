import { ErrorStateMatcher } from '@angular/material/core';
import { UntypedFormControl } from '@angular/forms';
import { isValidU32 } from '@platform/env/num';

export enum Field {
    baudRate = 'baudRate',
}

export enum Codes {
    NO_ERRORS = 'NO_ERRORS',
    REQUIRED = 'REQUIRED',
    INVALID = 'INVALID',
}

export type UpdateHandler = () => void;

export class ErrorState implements ErrorStateMatcher {
    readonly _alias: Field;
    readonly _updated: UpdateHandler;
    private _code: Codes = Codes.NO_ERRORS;

    constructor(alias: Field, updated: UpdateHandler) {
        this._alias = alias;
        this._updated = updated;
    }

    public isErrorState(control: UntypedFormControl | null): boolean {
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
        this._updated();
        return this._code !== Codes.NO_ERRORS;
    }

    public isFieldValid(value: number): boolean {
        if (typeof value !== 'number') {
            return false;
        }
        return isNaN(value) ? false : !isFinite(value) ? false : isValidU32(value);
    }

    public isFieldRequired(value: number): boolean {
        return typeof value !== 'number';
    }

    public getErrorCode(): Codes {
        return this._code;
    }

    public isValid(): boolean {
        return this._code === Codes.NO_ERRORS;
    }
}
