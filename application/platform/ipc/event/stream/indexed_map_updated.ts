import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'IndexedMapUpdated' })
export class Event extends SignatureRequirement {
    public session: string;
    public len: number;

    constructor(input: { session: string; len: number }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.len = validator.getAsValidNumber(input, 'len');
    }
}

export interface Event extends Interface {}
