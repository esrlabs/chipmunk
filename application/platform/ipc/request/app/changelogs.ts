import { Define, Interface, SignatureRequirement } from '../declarations';
import * as validator from '../../../env/obj';

@Define({ name: 'GetAppChangelogsRequest' })
export class Request extends SignatureRequirement {
    public version?: string;

    constructor(input: { version: string | undefined }) {
        super();
        validator.isObject(input);
        this.version = validator.getAsNotEmptyStringOrAsUndefined(input, 'version');
    }
}
export interface Request extends Interface {}

@Define({ name: 'GetAppChangelogsResponse' })
export class Response extends SignatureRequirement {
    public markdown: string;
    public version: string;
    public error: string | undefined;

    constructor(input: { markdown: string; version: string; error: string | undefined }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
        this.markdown = validator.getAsString(input, 'markdown');
        this.version = validator.getAsString(input, 'version');
    }
}

export interface Response extends Interface {}
