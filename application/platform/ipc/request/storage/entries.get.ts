import { Define, Interface, SignatureRequirement } from '../declarations';
import { Entry } from '../../../types/storage/entry';

import * as validator from '../../../env/obj';

@Define({ name: 'EntriesGetRequest' })
export class Request extends SignatureRequirement {
    public key?: string;
    public file?: string;

    constructor(input: { key?: string; file?: string }) {
        super();
        validator.isObject(input);
        this.key = validator.getAsNotEmptyStringOrAsUndefined(input, 'key');
        this.file = validator.getAsNotEmptyStringOrAsUndefined(input, 'file');
        if (this.key === undefined && this.file === undefined) {
            throw new Error(`For EntriesGetRequest should be defined "file" or "key"`);
        }
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
        this.entries = validator.getAsArray(input, 'entries');
        this.key = validator.getAsNotEmptyString(input, 'key');
        this.entries = validator.getAsArray(input, 'entries');
    }
}

export interface Response extends Interface {}
