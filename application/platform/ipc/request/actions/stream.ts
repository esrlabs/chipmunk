import { Define, Interface, SignatureRequirement } from '../declarations';
import { ParserName } from '../../../types/observe';
import { Source } from '../../../types/transport';

import * as validator from '../../../env/obj';

@Define({ name: 'StreamActionRequest' })
export class Request extends SignatureRequirement {
    public type: ParserName;
    public source?: Source;

    constructor(input: { type: ParserName; source: Source | undefined }) {
        super();
        validator.isObject(input);
        this.type = validator.getAsNotEmptyString(input, 'type') as ParserName;
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
