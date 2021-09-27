import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import {
    isValidIPv4,
    isValidIPv6,
} from '../../../../../../../common/functionlity/functions.ipaddr';

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

export enum EDLTSettingsFieldAlias {
    bindingAddress = 'bindingAddress',
    bindingPort = 'bindingPort',
    multicastAddress = 'multicastAddress',
    multicastInterface = 'multicastInterface',
    ecu = 'ecu',
}

export enum EDLTSettingsErrorCodes {
    NO_ERRORS = 'NO_ERRORS',
    REQUIRED = 'REQUIRED',
    INVALID = 'INVALID',
}

export class DLTDeamonSettingsErrorStateMatcher implements ErrorStateMatcher {
    readonly _alias: EDLTSettingsFieldAlias;
    private _code: EDLTSettingsErrorCodes = EDLTSettingsErrorCodes.NO_ERRORS;

    constructor(alias: EDLTSettingsFieldAlias) {
        this._alias = alias;
    }

    public isErrorState(
        control: FormControl | null,
        form: FormGroupDirective | NgForm | null,
    ): boolean {
        if (control === null) {
            return false;
        }
        if (this.isDLTSettingsFieldRequired(control.value)) {
            this._code = EDLTSettingsErrorCodes.REQUIRED;
        } else if (!this.isDLTSettingsFieldValid(control.value)) {
            this._code = EDLTSettingsErrorCodes.INVALID;
        } else {
            this._code = EDLTSettingsErrorCodes.NO_ERRORS;
        }
        return this._code !== EDLTSettingsErrorCodes.NO_ERRORS;
    }

    public isDLTSettingsFieldValid(value: string): boolean {
        if (typeof value !== 'string') {
            return false;
        }
        switch (this._alias) {
            case EDLTSettingsFieldAlias.ecu:
                return value.length <= 255;
            case EDLTSettingsFieldAlias.bindingAddress:
            case EDLTSettingsFieldAlias.multicastAddress:
                return isValidIPv4(value) || isValidIPv6(value);
            case EDLTSettingsFieldAlias.multicastInterface:
                return isValidIPv4(value) || isValidU32(value);
            case EDLTSettingsFieldAlias.bindingPort:
                if (value.trim().search(/^\d{1,}$/gi) === -1) {
                    return false;
                }
                const bindingPort = parseInt(value.trim(), 10);
                return isNaN(bindingPort) ? false : !isFinite(bindingPort) ? false : true;
        }
    }

    public isDLTSettingsFieldRequired(value: string): boolean {
        if (typeof value !== 'string') {
            return true;
        }
        switch (this._alias) {
            case EDLTSettingsFieldAlias.ecu:
            case EDLTSettingsFieldAlias.bindingAddress:
            case EDLTSettingsFieldAlias.bindingPort:
            case EDLTSettingsFieldAlias.multicastAddress:
            case EDLTSettingsFieldAlias.multicastInterface:
                return value.trim() === '';
        }
    }

    public getErrorCode(): EDLTSettingsErrorCodes {
        return this._code;
    }

    public isValid(): boolean {
        return this._code === EDLTSettingsErrorCodes.NO_ERRORS;
    }
}
