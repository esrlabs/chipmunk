import { Define, Interface, SignatureRequirement } from '../declarations';
import { IFilter, ISearchResults } from '../../../types/filter';

import * as validator from '../../../env/obj';

@Define({ name: 'NearestRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public row: number;

    constructor(input: { session: string; row: number }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.row = validator.getAsValidNumber(input, 'row');
    }
}

export interface Request extends Interface {}

@Define({ name: 'NearestResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public stream: number;
    public position: number;

    constructor(input: { session: string; stream: number; position: number }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.stream = validator.getAsValidNumber(input, 'stream');
        this.position = validator.getAsValidNumber(input, 'position');
    }
}

export interface Response extends Interface {}
