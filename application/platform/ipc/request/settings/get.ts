import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'GetSettingValueRequest' })
export class Request extends SignatureRequirement {
    public path: string;
    public key: string;

    constructor(input: { path: string; key: string }) {
        super();
        validator.isObject(input);
        this.path = validator.getAsNotEmptyString(input, 'path');
        this.key = validator.getAsNotEmptyString(input, 'key');
    }
}

export interface Request extends Interface {}

@Define({ name: 'GetSettingValueResponse' })
export class Response extends SignatureRequirement {
    public value: string | undefined | number | boolean;
    constructor(input: { value: string | undefined | number | boolean }) {
        super();
        validator.isObject(input);
        this.value = input.value;
    }
}

export interface Response extends Interface {}
