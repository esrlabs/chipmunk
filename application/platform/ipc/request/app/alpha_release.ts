import { Define, Interface, SignatureRequirement } from '../declarations';
import * as validator from '../../../env/obj';

@Define({ name: 'GetAppAlphaReleaseRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'GetAppAlphaReleaseResponse' })
export class Response extends SignatureRequirement {
    public version: string | undefined;
    public url: string | undefined;
    public error: string | undefined;

    constructor(input: { version: string | undefined; url: string | undefined; error: string | undefined }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
        this.version = validator.getAsNotEmptyStringOrAsUndefined(input, 'version');
        this.url = validator.getAsNotEmptyStringOrAsUndefined(input, 'url');
    }
}

export interface Response extends Interface {}
