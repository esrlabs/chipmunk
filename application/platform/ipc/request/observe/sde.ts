import { Define, Interface, SignatureRequirement } from '../declarations';
import { SdeRequest, SdeResponse } from '../../../types/sde';

import * as validator from '../../../env/obj';

@Define({ name: 'SDERequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public operation: string;
    public request: SdeRequest;

    constructor(input: { session: string; operation: string; request: SdeRequest }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.operation = validator.getAsNotEmptyString(input, 'operation');
        this.request = validator.getAsObj(input, 'request');
    }
}

export interface Request extends Interface {}

@Define({ name: 'SDEResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public result?: SdeResponse;
    public error?: string;

    constructor(input: { session: string; result?: SdeResponse; error?: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.result = validator.getAsObjOrUndefined(input, 'result');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
