import { Define, Interface, SignatureRequirement } from '../declarations';
import { IFilter } from '../../../types/filter';

import * as validator from '../../../env/obj';

@Define({ name: 'RegExValidateRequest' })
export class Request extends SignatureRequirement {
    public filter: IFilter;

    constructor(input: { filter: IFilter }) {
        super();
        validator.isObject(input);
        this.filter = validator.getAsObj(input, 'filter');
    }
}

export interface Request extends Interface {}

@Define({ name: 'RegExValidateResponse' })
export class Response extends SignatureRequirement {
    public error?: string;

    constructor(input: { error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
