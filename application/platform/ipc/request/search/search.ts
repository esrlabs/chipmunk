import { Define, Interface, SignatureRequirement } from '../declarations';
import { IFilter } from '../../../types/filter';

import * as validator from '../../../env/obj';

@Define({ name: 'SearchRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public filters: IFilter[];

    constructor(input: { session: string; filters: IFilter[] }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.filters = validator.getAsArray(input, 'filters');
    }
}

export interface Request extends Interface {}

@Define({ name: 'SearchResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public found: number;
    public canceled: boolean;

    constructor(input: { session: string; found: number; canceled: boolean }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.found = validator.getAsValidNumber(input, 'found');
        this.canceled = validator.getAsBool(input, 'canceled');
    }
}

export interface Response extends Interface {}
