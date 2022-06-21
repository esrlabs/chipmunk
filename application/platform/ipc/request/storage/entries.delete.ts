import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'EntriesDeleteRequest' })
export class Request extends SignatureRequirement {
    public key: string;
    public uuids: string[];
    constructor(input: { key: string; uuids: string[] }) {
        super();
        validator.isObject(input);
        this.key = validator.getAsNotEmptyString(input, 'key');
        this.uuids = validator.getAsArray(input, 'uuids');
    }
}

export interface Request extends Interface {}

@Define({ name: 'EntriesDeleteResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
