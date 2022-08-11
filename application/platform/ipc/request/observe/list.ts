import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'ObserveListRequest' })
export class Request extends SignatureRequirement {
    public session: string;

    constructor(input: { session: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}

export interface Request extends Interface {}

@Define({ name: 'ObserveListResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public sources: { [key: string]: string };

    constructor(input: { session: string; sources: { [key: string]: string } }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.sources = validator.getAsObj(input, 'sources');
    }
}

export interface Response extends Interface {}
