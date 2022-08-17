import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'SDERequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public operation: string;
    public json: string;

    constructor(input: { session: string; operation: string; json: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.operation = validator.getAsNotEmptyString(input, 'operation');
        this.json = validator.getAsNotEmptyString(input, 'json');
    }
}

export interface Request extends Interface {}

@Define({ name: 'SDEResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public result?: string;
    public error?: string;

    constructor(input: { session: string; result?: string; error?: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.result = validator.getAsNotEmptyStringOrAsUndefined(input, 'result');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
