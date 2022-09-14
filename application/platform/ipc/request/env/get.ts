import { Define, Interface, SignatureRequirement } from '../declarations';
import * as validator from '../../../env/obj';

@Define({ name: 'EnvGetRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'EnvGetResponse' })
export class Response extends SignatureRequirement {
    public env: { [key: string]: string };
    public error: string | undefined;

    constructor(input: { error: string | undefined; env: { [key: string]: string } }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
        this.env = validator.getAsObj(input, 'env');
    }
}

export interface Response extends Interface {}
