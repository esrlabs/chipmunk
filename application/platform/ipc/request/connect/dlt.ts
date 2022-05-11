import { Define, Interface, SignatureRequirement } from '../declarations';
import { IDLTOptions } from '../../../types/parsers/dlt';
import { SourceDefinition } from '../../../types/transport';
import * as validator from '../../../env/obj';

@Define({ name: 'DltConnectRequest' })
export class Request extends SignatureRequirement {
    public options: IDLTOptions;
    public source: SourceDefinition;
    public session: string;

    constructor(input: { options: IDLTOptions; source: SourceDefinition; session: string }) {
        super();
        validator.isObject(input);
        this.options = validator.getAsObj(input, 'options');
        this.source = validator.getAsObj(input, 'source');
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}
export interface Request extends Interface {}

@Define({ name: 'DltConnectResponse' })
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
