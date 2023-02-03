import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'TriggerCheckingUpdatesRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'TriggerCheckingUpdatesResponse' })
export class Response extends SignatureRequirement {
    public report?: string;
    public error?: string;

    constructor(input: { report?: string; error?: string }) {
        super();
        validator.isObject(input);
        this.report = validator.getAsNotEmptyStringOrAsUndefined(input, 'report');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
