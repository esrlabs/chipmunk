import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'SearchUpdated' })
export class Event extends SignatureRequirement {
    public session: string;
    public rows: number;
    public stat: { [key: string]: number };

    constructor(input: { session: string; rows: number; stat: { [key: string]: number } }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.rows = validator.getAsValidNumber(input, 'rows');
        this.stat = validator.getAsObj(input, 'stat');
    }
}

export interface Event extends Interface {}
