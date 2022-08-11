import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'ObserveOperationFinished' })
export class Event extends SignatureRequirement {
    public session: string;
    public operation: string;
    public source: string;

    constructor(input: { session: string; operation: string; source: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.operation = validator.getAsNotEmptyString(input, 'operation');
        this.source = validator.getAsNotEmptyString(input, 'source');
    }
}

export interface Event extends Interface {}
