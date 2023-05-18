import { Define, Interface, SignatureRequirement } from '../declarations';
import { IValuesMap } from '../../../interfaces/interface.rust.api.general';

import * as validator from '../../../env/obj';

@Define({ name: 'SearchValuesGettingRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public width: number;
    public from?: number;
    public to?: number;

    constructor(input: { session: string; width: number; from?: number; to?: number }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.width = validator.getAsValidNumber(input, 'width');
        this.from = validator.getAsValidNumberOrUndefined(input, 'from');
        this.to = validator.getAsValidNumberOrUndefined(input, 'to');
    }
}

export interface Request extends Interface {}

@Define({ name: 'SearchValuesGettingResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public values: IValuesMap;
    public canceled: boolean;
    public error?: string;

    constructor(input: { session: string; values: IValuesMap; canceled: boolean; error?: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.values = validator.getAsObj(input, 'values');
        this.canceled = validator.getAsBool(input, 'canceled');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
