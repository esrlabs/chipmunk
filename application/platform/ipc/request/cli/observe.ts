import { Define, Interface, SignatureRequirement } from '../declarations';
import { SessionSetup } from '../../../types/bindings/observe';

import * as validator from '../../../env/obj';

@Define({ name: 'ObserveCLICommandRequest' })
export class Request extends SignatureRequirement {
    public observe: SessionSetup[];

    constructor(input: { observe: SessionSetup[] }) {
        super();
        validator.isObject(input);
        this.observe = validator.getAsObj(input, 'observe');
    }
}

export interface Request extends Interface {}

@Define({ name: 'ObserveCLICommandResponse' })
export class Response extends SignatureRequirement {
    public session: string | undefined;
    public error?: string;

    constructor(input: { session: string | undefined; error?: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyStringOrAsUndefined(input, 'session');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
