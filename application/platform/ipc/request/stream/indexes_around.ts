import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'GetIndexesAroundRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public row: number;

    constructor(input: { session: string; row: number }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.row = validator.getAsValidNumber(input, 'row');
    }
}

export interface Request extends Interface {}

@Define({ name: 'GetIndexesAroundResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public before: number | undefined;
    public after: number | undefined;
    public error?: string;

    constructor(input: {
        session: string;
        before: number | undefined;
        after: number | undefined;
        error?: string;
    }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.before = validator.getAsValidNumberOrUndefined(input, 'before');
        this.after = validator.getAsValidNumberOrUndefined(input, 'after');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
