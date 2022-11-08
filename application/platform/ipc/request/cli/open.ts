import { Define, Interface, SignatureRequirement } from '../declarations';
import * as validator from '../../../env/obj';

@Define({ name: 'CliOpenFilesRequest' })
export class Request extends SignatureRequirement {
    public files: string[];

    constructor(input: { files: string[] }) {
        super();
        validator.isObject(input);
        this.files = validator.getAsArray(input, 'files');
    }
}
export interface Request extends Interface {}

@Define({ name: 'CliOpenFilesResponse' })
export class Response extends SignatureRequirement {
    public sessions: string[] | undefined;
    public error: string | undefined;

    constructor(input: { sessions: string[] | undefined; error: string | undefined }) {
        super();
        validator.isObject(input);
        this.sessions = validator.getAsArrayOrUndefined(input, 'sessions');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
