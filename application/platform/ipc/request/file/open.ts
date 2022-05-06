import { Define, Interface, SignatureRequirement } from '../declarations';
import { TargetFile } from '../../../types/files';
import * as validator from '../../../env/obj';

@Define({ name: 'OpenFileRequest' })
export class Request extends SignatureRequirement {
    public file?: TargetFile;
    public session: string;

    constructor(input: { session: string; file?: TargetFile }) {
        super();
        validator.isObject(input);
        this.file = input.file;
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}
export interface Request extends Interface {}

@Define({ name: 'OpenFileResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public session: string;

    constructor(input: { session: string; error?: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
