import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'StorageWriteRequest' })
export class Request extends SignatureRequirement {
    public key: string;
    public content: string;
    constructor(input: { key: string; content: string }) {
        super();
        validator.isObject(input);
        this.key = validator.getAsNotEmptyString(input, 'key');
        this.content = validator.getAsNotEmptyString(input, 'content');
    }
}

export interface Request extends Interface {}

@Define({ name: 'StorageWriteResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
