import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';

export enum EDLTSettingsFieldAlias {
    bindingAddressV4 = 'bindingAddressV4',
    bindingAddressV6 = 'bindingAddressV6',
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
            case EDLTSettingsFieldAlias.bindingAddressV4:
            case EDLTSettingsFieldAlias.multicastAddress:
            case EDLTSettingsFieldAlias.multicastInterface:
                return value.replace(/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi, '').trim() === '';
            case EDLTSettingsFieldAlias.bindingAddressV6:
                return value.replace(/(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/gi, '').trim() === '';
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
            case EDLTSettingsFieldAlias.bindingAddressV4:
            case EDLTSettingsFieldAlias.bindingAddressV6:
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
