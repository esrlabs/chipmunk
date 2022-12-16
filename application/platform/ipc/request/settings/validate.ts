import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'ValidateSettingValueRequest' })
export class Request extends SignatureRequirement {
    public path: string;
    public key: string;
    public value: string | number | boolean | undefined;

    constructor(input: {
        path: string;
        key: string;
        value: string | number | boolean | undefined;
    }) {
        super();
        validator.isObject(input);
        this.path = validator.getAsNotEmptyString(input, 'path');
        this.key = validator.getAsNotEmptyString(input, 'key');
        this.value = input.value;
    }
}

export interface Request extends Interface {}

@Define({ name: 'ValidateSettingValueResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    constructor(input: { error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
