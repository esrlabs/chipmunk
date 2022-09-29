import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'SaveFileRequest' })
export class Request extends SignatureRequirement {
    public ext?: string;

    constructor(input: { ext?: string }) {
        super();
        validator.isObject(input);
        this.ext = validator.getAsNotEmptyStringOrAsUndefined(input, 'ext');
    }
}
export interface Request extends Interface {}

@Define({ name: 'SaveFileResponse' })
export class Response extends SignatureRequirement {
    public filename?: string;
    public error?: string;

    constructor(input: { filename?: string; error?: string }) {
        super();
        validator.isObject(input);
        this.filename = validator.getAsNotEmptyStringOrAsUndefined(input, 'filename');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
