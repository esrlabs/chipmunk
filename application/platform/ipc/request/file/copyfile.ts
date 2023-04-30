import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'CopyFileRequest' })
export class Request extends SignatureRequirement {
    public src: string;
    public dest: string;

    constructor(input: { src: string; dest: string }) {
        super();
        validator.isObject(input);
        this.src = validator.getAsNotEmptyString(input, 'src');
        this.dest = validator.getAsNotEmptyString(input, 'dest');
    }
}
export interface Request extends Interface {}

@Define({ name: 'CopyFileResponse' })
export class Response extends SignatureRequirement {
    public error?: string;

    constructor(input: { error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
