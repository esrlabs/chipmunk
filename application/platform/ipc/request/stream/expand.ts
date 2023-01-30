import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'ExpandIndexedMapRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public seporator: number;
    public offset: number;
    public above: boolean;

    constructor(input: { session: string; seporator: number; offset: number; above: boolean }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.seporator = validator.getAsValidNumber(input, 'seporator');
        this.offset = validator.getAsValidNumber(input, 'offset');
        this.above = validator.getAsBool(input, 'above');
    }
}

export interface Request extends Interface {}

@Define({ name: 'ExpandIndexedMapResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public error?: string;

    constructor(input: { session: string; error?: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
