import { Define, Interface, SignatureRequirement } from '../declarations';
import { Entry } from '../../../types/storage/entry';

import * as validator from '../../../env/obj';

export type Mode = 'overwrite' | 'update' | 'append';

@Define({ name: 'EntriesSetRequest' })
export class Request extends SignatureRequirement {
    public key?: string;
    public file?: string;
    public entries: Entry[];
    public mode: Mode;
    constructor(input: { key?: string; file?: string; entries: Entry[]; mode: Mode }) {
        super();
        validator.isObject(input);
        this.key = validator.getAsNotEmptyStringOrAsUndefined(input, 'key');
        this.file = validator.getAsNotEmptyStringOrAsUndefined(input, 'file');
        this.mode = validator.getAsNotEmptyString(input, 'mode') as Mode;
        this.entries = validator.getAsArray(input, 'entries');
        if (this.key === undefined && this.file === undefined) {
            throw new Error(`For EntriesSetRequest should be defined "file" or "key"`);
        }
    }
}

export interface Request extends Interface {}

@Define({ name: 'EntriesSetResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
