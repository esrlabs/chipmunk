import { ErrorStateMatcher } from '@angular/material/core';
import { UntypedFormControl } from '@angular/forms';
import { isValidIPv4, isValidIPv6 } from '@platform/env/ipaddr';

const U32 = [0, 4294967295];

function isValidU32(value: string): boolean {
    const u32: number = parseInt(value, 10);
    if (isNaN(u32) || !isFinite(u32)) {
        return false;
    }
    if (u32 < U32[0] || u32 > U32[1]) {
        return false;
    }
    return true;
}

export enum Field {
    bindingAddress = 'bindingAddress',
    bindingPort = 'bindingPort',
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
        //form: FormGroupDirective | NgForm | null,
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
                return isValidIPv4(value) || isValidIPv6(value);
            case Field.multicastInterface:
                return isValidIPv4(value) || isValidU32(value);
            case Field.bindingPort: {
                if (value.trim().search(/^\d{1,}$/gi) === -1) {
                    return false;
                }
                const bindingPort = parseInt(value.trim(), 10);
                return isNaN(bindingPort) ? false : !isFinite(bindingPort) ? false : true;
            }
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
            case Field.bindingPort:
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
