import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'IsBinaryRequest' })
export class Request extends SignatureRequirement {
    public file: string;

    constructor(input: { file: string }) {
        super();
        validator.isObject(input);
        this.file = validator.getAsNotEmptyString(input, 'file');
    }
}
export interface Request extends Interface {}

@Define({ name: 'IsBinaryResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public binary: boolean;
    constructor(input: { binary: boolean; error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
        this.binary = validator.getAsBool(input, 'binary');
    }
}

export interface Response extends Interface {}
