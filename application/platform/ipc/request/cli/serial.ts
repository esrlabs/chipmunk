import { Define, Interface, SignatureRequirement } from '../declarations';
import { ParserName } from '../../../types/observe';
import { SerialTransportSettings } from '../../../types/transport/serial';

import * as validator from '../../../env/obj';

@Define({ name: 'CliSerialRequest' })
export class Request extends SignatureRequirement {
    public source: SerialTransportSettings;
    public parser: ParserName;

    constructor(input: { source: SerialTransportSettings; parser: ParserName }) {
        super();
        validator.isObject(input);
        this.source = validator.getAsObj(input, 'source');
        this.parser = validator.getAsNotEmptyString(input, 'parser') as ParserName;
    }
}
export interface Request extends Interface {}

@Define({ name: 'CliSerialResponse' })
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
