import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'StorageDeleteRequest' })
export class Request extends SignatureRequirement {
    public key: string;
    constructor(input: { key: string }) {
        super();
        validator.isObject(input);
        this.key = validator.getAsNotEmptyString(input, 'key');
    }
}

export interface Request extends Interface {}

@Define({ name: 'StorageDeleteResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
