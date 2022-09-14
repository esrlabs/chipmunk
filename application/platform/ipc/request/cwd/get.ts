import { Define, Interface, SignatureRequirement } from '../declarations';
import * as validator from '../../../env/obj';

@Define({ name: 'CwdGetRequest' })
export class Request extends SignatureRequirement {
    public uuid: string | undefined;

    constructor(input: { uuid: string | undefined }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyStringOrAsUndefined(input, 'uuid');
    }
}
export interface Request extends Interface {}

@Define({ name: 'CwdGetResponse' })
export class Response extends SignatureRequirement {
    public uuid: string | undefined;
    public cwd: string;

    constructor(input: { uuid: string | undefined; cwd: string }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyStringOrAsUndefined(input, 'uuid');
        this.cwd = validator.getAsNotEmptyString(input, 'cwd');
    }
}

export interface Response extends Interface {}
