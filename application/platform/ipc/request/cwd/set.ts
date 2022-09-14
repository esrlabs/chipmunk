import { Define, Interface, SignatureRequirement } from '../declarations';
import * as validator from '../../../env/obj';

@Define({ name: 'CwdSetRequest' })
export class Request extends SignatureRequirement {
    public uuid: string | undefined;
    public cwd: string;

    constructor(input: { uuid: string | undefined; cwd: string }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyStringOrAsUndefined(input, 'uuid');
        this.cwd = validator.getAsNotEmptyString(input, 'cwd');
    }
}
export interface Request extends Interface {}

@Define({ name: 'CwdSetResponse' })
export class Response extends SignatureRequirement {
    public uuid: string | undefined;
    public error: string | undefined;

    constructor(input: { uuid: string | undefined; error: string | undefined }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyStringOrAsUndefined(input, 'uuid');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
