import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'ListEnvVarsRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'ListEnvVarsResponse' })
export class Response extends SignatureRequirement {
    public envvars: Map<string, string>;

    constructor(input: { envvars: Map<string, string> }) {
        super();
        validator.isObject(input);
        this.envvars = validator.getAsObj(input, 'envvars');
    }
}

export interface Response extends Interface {}
