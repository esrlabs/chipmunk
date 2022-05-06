import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'StreamUpdated' })
export class Event extends SignatureRequirement {
    public session: string;
    public rows: number;

    constructor(input: {
        session: string;
        rows: number;
    }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.rows = validator.getAsValidNumber(input, 'rows');
    }
}

export interface Event extends Interface {}
