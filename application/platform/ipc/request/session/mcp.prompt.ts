import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'SessionMcpPromptRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public prompt: string;

    constructor(input: { session: string; prompt: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.prompt = validator.getAsNotEmptyString(input, 'prompt');
    }
}
export interface Request extends Interface {}

@Define({ name: 'SessionMcpPromptResponse' })
export class Response extends SignatureRequirement {
    public session: string;

    constructor(input: { session: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}

export interface Response extends Interface {}
