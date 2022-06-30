import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'StorageReadRequest' })
export class Request extends SignatureRequirement {
    public key: string;

    constructor(input: { key: string }) {
        super();
        validator.isObject(input);
        this.key = validator.getAsNotEmptyString(input, 'key');
    }
}

export interface Request extends Interface {}

@Define({ name: 'StorageReadResponse' })
export class Response extends SignatureRequirement {
    public key: string;
    public content: string;
    constructor(input: { key: string; content: string }) {
        super();
        validator.isObject(input);
        this.key = validator.getAsNotEmptyString(input, 'key');
        this.content = validator.getAsString(input, 'content');
    }
}

export interface Response extends Interface {}
