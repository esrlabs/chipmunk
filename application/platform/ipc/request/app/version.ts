import { Define, Interface, SignatureRequirement } from '../declarations';
import * as validator from '../../../env/obj';

@Define({ name: 'GetAppVersionRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'GetAppVersionResponse' })
export class Response extends SignatureRequirement {
    public version: string;
    public error: string | undefined;

    constructor(input: { version: string; error: string | undefined }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
        this.version = validator.getAsString(input, 'version');
    }
}

export interface Response extends Interface {}
