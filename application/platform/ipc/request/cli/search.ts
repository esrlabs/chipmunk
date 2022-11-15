import { Define, Interface, SignatureRequirement } from '../declarations';
import * as validator from '../../../env/obj';

@Define({ name: 'CliSearchRequest' })
export class Request extends SignatureRequirement {
    public sessions: string[];
    public filters: string[];

    constructor(input: { sessions: string[]; filters: string[] }) {
        super();
        validator.isObject(input);
        this.sessions = validator.getAsArray(input, 'sessions');
        this.filters = validator.getAsArray(input, 'filters');
    }
}
export interface Request extends Interface {}

@Define({ name: 'CliSearchResponse' })
export class Response extends SignatureRequirement {
    public error: string | undefined;

    constructor(input: {  error: string | undefined }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
