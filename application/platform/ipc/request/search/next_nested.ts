import { Define, Interface, SignatureRequirement } from '../declarations';
import { IFilter } from '../../../types/filter';

import * as validator from '../../../env/obj';

@Define({ name: 'SearchNextNestedRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public filter: IFilter;
    public from: number;

    constructor(input: { session: string; filter: IFilter; from: number }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.filter = validator.getAsObj(input, 'filter');
        this.from = validator.getAsValidNumber(input, 'from');
    }
}

export interface Request extends Interface {}

@Define({ name: 'SearchNextNestedResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public pos: number | undefined;

    constructor(input: { session: string; pos: number | undefined }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.pos = validator.getAsValidNumberOrUndefined(input, 'pos');
    }
}

export interface Response extends Interface {}
