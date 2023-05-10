import { Define, Interface, SignatureRequirement } from '../declarations';
import { ISomeIpOptions } from '../../../types/parsers/someip';
import { SourceDefinition } from '../../../types/transport';
import * as validator from '../../../env/obj';

@Define({ name: 'SomeIpConnectRequest' })
export class Request extends SignatureRequirement {
    public options: ISomeIpOptions;
    public source: SourceDefinition;
    public session: string;

    constructor(input: { options: ISomeIpOptions; source: SourceDefinition; session: string }) {
        super();
        validator.isObject(input);
        this.options = validator.getAsObj(input, 'options');
        this.source = validator.getAsObj(input, 'source');
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}
export interface Request extends Interface {}

@Define({ name: 'SomeIpConnectResponse' })
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
