import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'GetIndexedLenRequest' })
export class Request extends SignatureRequirement {
    public session: string;

    constructor(input: { session: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}

export interface Request extends Interface {}

@Define({ name: 'GetIndexedLenResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public len: number;

    constructor(input: { session: string; len: number }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.len = validator.getAsValidNumber(input, 'len');
    }
}

export interface Response extends Interface {}
