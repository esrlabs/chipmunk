import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'ReadFileRequest' })
export class Request extends SignatureRequirement {
    public file: string;

    constructor(input: { file: string }) {
        super();
        validator.isObject(input);
        this.file = validator.getAsNotEmptyString(input, 'file');
    }
}
export interface Request extends Interface {}

@Define({ name: 'ReadFilesResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public text?: string;

    constructor(input: { text?: string; error?: string }) {
        super();
        validator.isObject(input);
        this.text = validator.getAsNotEmptyStringOrAsUndefined(input, 'text');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
