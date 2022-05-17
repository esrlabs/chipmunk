import { Define, Interface, SignatureRequirement } from '../declarations';
import { Entry } from '../../../types/storage/entry';

import * as validator from '../../../env/obj';

export type Mode = 'overwrite' | 'update' | 'append';

@Define({ name: 'EntriesSetRequest' })
export class Request extends SignatureRequirement {
    public key: string;
    public entries: Entry[];
    public mode: Mode;
    constructor(input: { key: string; entries: Entry[]; mode: Mode }) {
        super();
        validator.isObject(input);
        this.key = validator.getAsNotEmptyString(input, 'key');
        this.mode = validator.getAsNotEmptyString(input, 'mode') as Mode;
        this.entries = validator.getAsArray(input, 'entries');
    }
}

export interface Request extends Interface {}

@Define({ name: 'EntriesSetResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
