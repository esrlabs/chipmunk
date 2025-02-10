import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'WriteFileRequest' })
export class Request extends SignatureRequirement {
    public filename: string;
    public content: string;
    public overwrite: boolean;

    constructor(input: { filename: string; content: string; overwrite: boolean }) {
        super();
        validator.isObject(input);
        this.filename = validator.getAsNotEmptyString(input, 'filename');
        this.content = validator.getAsNotEmptyString(input, 'content');
        this.overwrite = validator.getAsBool(input, 'overwrite');
    }
}
export interface Request extends Interface {}

@Define({ name: 'WriteFileResponse' })
export class Response extends SignatureRequirement {
    public error?: string;

    constructor(input: { error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
