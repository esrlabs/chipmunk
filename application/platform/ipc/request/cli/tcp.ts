import { Define, Interface, SignatureRequirement } from '../declarations';
import { ParserName } from '../../../types/observe';
import { TCPTransportSettings } from '../../../types/transport/tcp';

import * as validator from '../../../env/obj';

@Define({ name: 'CliTcpRequest' })
export class Request extends SignatureRequirement {
    public source: TCPTransportSettings;
    public parser: ParserName;

    constructor(input: { source: TCPTransportSettings; parser: ParserName }) {
        super();
        validator.isObject(input);
        this.source = validator.getAsObj(input, 'source');
        this.parser = validator.getAsNotEmptyString(input, 'parser') as ParserName;
    }
}
export interface Request extends Interface {}

@Define({ name: 'CliTcpResponse' })
export class Response extends SignatureRequirement {
    public sessions: string[] | undefined;
    public error: string | undefined;

    constructor(input: { sessions: string[] | undefined; error: string | undefined }) {
        super();
        validator.isObject(input);
        this.sessions = validator.getAsArrayOrUndefined(input, 'sessions');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
