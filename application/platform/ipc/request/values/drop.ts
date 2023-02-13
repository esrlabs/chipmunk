import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'SearchValuesDropRequest' })
export class Request extends SignatureRequirement {
    public session: string;

    constructor(input: { session: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}

export interface Request extends Interface {}

@Define({ name: 'SearchValuesDropResponse' })
export class Response extends SignatureRequirement {
    public session: string;

    constructor(input: { session: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}

export interface Response extends Interface {}
