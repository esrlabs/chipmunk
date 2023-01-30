import { Define, Interface, SignatureRequirement } from '../declarations';
import { IndexingMode } from '../../../types/content';

import * as validator from '../../../env/obj';

@Define({ name: 'StreamIndexingModeRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public mode: IndexingMode;

    constructor(input: { session: string; mode: IndexingMode }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.mode = validator.getAsValidNumber(input, 'mode');
    }
}

export interface Request extends Interface {}

@Define({ name: 'StreamIndexingModeResponse' })
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
