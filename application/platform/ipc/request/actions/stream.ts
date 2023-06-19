import { Define, Interface, SignatureRequirement } from '../declarations';
import { Protocol } from '../../../types/observe/parser';
import { Source } from '../../../types/observe/origin/stream/index';

import * as validator from '../../../env/obj';

@Define({ name: 'StreamActionRequest' })
export class Request extends SignatureRequirement {
    public protocol: Protocol;
    public source?: Source;

    constructor(input: { protocol: Protocol; source: Source | undefined }) {
        super();
        validator.isObject(input);
        this.protocol = validator.getAsNotEmptyString(input, 'protocol') as Protocol;
        this.source = validator.getAsNotEmptyStringOrAsUndefined(input, 'source') as Source;
    }
}
export interface Request extends Interface {}

@Define({ name: 'StreamActionResponse' })
export class Response extends SignatureRequirement {
    public error: string | undefined;

    constructor(input: { error: string | undefined }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
