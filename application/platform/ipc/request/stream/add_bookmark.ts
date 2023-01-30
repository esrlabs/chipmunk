import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'AddBookmarkRequest' })
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

@Define({ name: 'AddBookmarkResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public error?: string;

    constructor(input: { session: string; error?: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
