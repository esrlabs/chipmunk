import { Define, Interface, SignatureRequirement } from '../declarations';
import * as validator from '../../../env/obj';

@Define({ name: 'EnvSetRequest' })
export class Request extends SignatureRequirement {
    public env: { [key: string]: string };

    constructor(input: { env: { [key: string]: string } }) {
        super();
        validator.isObject(input);
        this.env = validator.getAsObj(input, 'env');
    }
}
export interface Request extends Interface {}

@Define({ name: 'EnvSetResponse' })
export class Response extends SignatureRequirement {
    public error: string | undefined;

    constructor(input: { error: string | undefined }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
