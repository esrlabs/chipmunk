import { Define, Interface, SignatureRequirement } from '../declarations';
import { SessionSetup } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'StartObserveRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public options: SessionSetup;

    constructor(input: { session: string; options: SessionSetup }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.options = validator.getAsObj(input, 'options');
    }
}

export interface Request extends Interface {}

@Define({ name: 'StartObserveResponse' })
export class Response extends SignatureRequirement {
    /// Session Uuid
    public session: string;
    /// Operation Uuid
    public uuid?: string;
    public error?: string;

    constructor(input: { session: string; uuid: string | undefined; error?: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.uuid = validator.getAsNotEmptyStringOrAsUndefined(input, 'uuid');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
