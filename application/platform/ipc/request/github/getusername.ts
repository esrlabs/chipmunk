import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'GetCurrentUserNameByTokenRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'GetCurrentUserNameByTokenResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public username?: string;

    constructor(input: { username?: string; error?: string }) {
        super();
        validator.isObject(input);
        this.username = validator.getAsNotEmptyStringOrAsUndefined(input, 'username');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
