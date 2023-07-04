import { ErrorStateMatcher } from '@angular/material/core';
import { UntypedFormControl, FormGroupDirective, NgForm } from '@angular/forms';

import * as ip from '@platform/env/ipaddr';

export enum Field {
    bindingAddress = 'bindingAddress',
    multicastAddress = 'multicastAddress',
    multicastInterface = 'multicastInterface',
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

    public isErrorState(
        control: UntypedFormControl | null,
        _form: FormGroupDirective | NgForm | null,
    ): boolean {
        if (control === null) {
            return false;
        }
        const prev = this._code;
        if (this.isFieldRequired(control.value)) {
            this._code = Codes.REQUIRED;
        } else if (!this.isFieldValid(control.value)) {
            this._code = Codes.INVALID;
        } else {
            this._code = Codes.NO_ERRORS;
        }
        prev !== this._code && this._updated();
        return this._code !== Codes.NO_ERRORS;
    }

    public isFieldValid(value: string): boolean {
        if (typeof value !== 'string') {
            return false;
        }
        switch (this._alias) {
            case Field.bindingAddress:
            case Field.multicastAddress:
                return (
                    ip.isValidIPv4(value) ||
                    ip.isValidIPv6(value) ||
                    ip.isValidIPv4WithPort(value) ||
                    ip.isValidIPv6WithPort(value)
                );
            case Field.multicastInterface:
                return ip.isValidIPv4(value) || ip.isValidIPv6(value);
            default:
                throw new Error(`Unexpected Field value: ${this._alias}`);
        }
    }

    public isFieldRequired(value: string): boolean {
        if (typeof value !== 'string') {
            return true;
        }
        switch (this._alias) {
            case Field.bindingAddress:
            case Field.multicastAddress:
            case Field.multicastInterface:
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
