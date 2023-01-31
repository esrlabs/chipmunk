import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'SetBookmarksRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public rows: number[];

    constructor(input: { session: string; rows: number[] }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.rows = validator.getAsArray(input, 'rows');
    }
}

export interface Request extends Interface {}

@Define({ name: 'SetBookmarksResponse' })
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
