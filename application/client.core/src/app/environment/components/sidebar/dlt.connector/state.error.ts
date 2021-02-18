import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';

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

    public isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
        if (this.isDLTSettingsFieldRequired(control.value)) {
            this._code = EDLTSettingsErrorCodes.REQUIRED;
        } else  if (!this.isDLTSettingsFieldValid(control.value)) {
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
            case EDLTSettingsFieldAlias.multicastInterface:
                return value.search(/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi) !== -1;
            case EDLTSettingsFieldAlias.bindingPort:
                if (value.trim().search(/^\d{1,}$/gi) === -1) {
                    return false;
                }
                const bindingPort = parseInt(value.trim(), 10);
                return isNaN(bindingPort) ? false : (!isFinite(bindingPort) ? false : true);
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
