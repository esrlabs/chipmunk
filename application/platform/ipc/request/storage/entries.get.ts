import { Define, Interface, SignatureRequirement } from '../declarations';
import { Entry } from '../../../types/storage/entry';

import * as validator from '../../../env/obj';

@Define({ name: 'EntriesGetRequest' })
export class Request extends SignatureRequirement {
    public key: string;

    constructor(input: { key: string }) {
        super();
        validator.isObject(input);
        this.key = validator.getAsNotEmptyString(input, 'key');
    }
}

export interface Request extends Interface {}

@Define({ name: 'EntriesGetResponse' })
export class Response extends SignatureRequirement {
    public key: string;
    public entries: Entry[];
    constructor(input: { key: string; entries: Entry[] }) {
        super();
        validator.isObject(input);
        this.key = validator.getAsNotEmptyString(input, 'key');
        this.entries = validator.getAsArray(input, 'entries');
    }
}

export interface Response extends Interface {}
