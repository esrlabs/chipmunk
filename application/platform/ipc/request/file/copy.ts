import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'CopyFilesRequest' })
export class Request extends SignatureRequirement {
    public files: string[];
    public dest: string;

    constructor(input: { files: string[]; dest: string }) {
        super();
        validator.isObject(input);
        this.files = validator.getAsArray(input, 'files');
        this.dest = validator.getAsNotEmptyString(input, 'dest');
    }
}
export interface Request extends Interface {}

@Define({ name: 'CopyFilesResponse' })
export class Response extends SignatureRequirement {
    public error?: string;

    constructor(input: { error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
