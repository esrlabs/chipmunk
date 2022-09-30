import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'ChecksumFileRequest' })
export class Request extends SignatureRequirement {
    public filename: string;

    constructor(input: { filename: string }) {
        super();
        validator.isObject(input);
        this.filename = validator.getAsNotEmptyString(input, 'filename');
    }
}
export interface Request extends Interface {}

@Define({ name: 'ChecksumFileResponse' })
export class Response extends SignatureRequirement {
    public hash?: string;
    public error?: string;

    constructor(input: { hash?: string; error?: string }) {
        super();
        validator.isObject(input);
        this.hash = validator.getAsNotEmptyStringOrAsUndefined(input, 'hash');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
