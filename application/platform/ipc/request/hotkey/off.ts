import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'StopListeningHotkeysRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'StopListeningHotkeysResponse' })
export class Response extends SignatureRequirement {
    public error: string | undefined;

    constructor(input: { error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
