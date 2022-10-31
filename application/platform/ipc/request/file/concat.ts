import { Define, Interface, SignatureRequirement } from '../declarations';
import { TargetFile } from '../../../types/files';

import * as validator from '../../../env/obj';

@Define({ name: 'ConcatFilesRequest' })
export class Request extends SignatureRequirement {
    public files?: TargetFile[];
    public session: string;

    constructor(input: { session: string; files?: TargetFile[] }) {
        super();
        validator.isObject(input);
        this.files = validator.getAsArrayOrUndefined(input, 'files');
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}
export interface Request extends Interface {}

@Define({ name: 'ConcatFilesResponse' })
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
