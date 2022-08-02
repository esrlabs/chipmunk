import { Define, Interface, SignatureRequirement } from '../declarations';
import { SourceDefinition } from '../../../types/transport';
import * as validator from '../../../env/obj';

@Define({ name: 'TextConnectRequest' })
export class Request extends SignatureRequirement {
    public source: SourceDefinition;
    public session: string;

    constructor(input: { source: SourceDefinition; session: string }) {
        super();
        validator.isObject(input);
        this.source = validator.getAsObj(input, 'source');
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}
export interface Request extends Interface {}

@Define({ name: 'TextConnectResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public session: string;

    constructor(input: { session: string; error?: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
