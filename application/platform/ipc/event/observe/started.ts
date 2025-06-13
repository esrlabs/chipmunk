import { Define, Interface, SignatureRequirement } from '../declarations';
import { SessionSetup } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'ObserveOperationStarted' })
export class Event extends SignatureRequirement {
    public session: string;
    public operation: string;
    public options: SessionSetup;

    constructor(input: { session: string; operation: string; options: SessionSetup }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.operation = validator.getAsNotEmptyString(input, 'operation');
        this.options = validator.getAsObj(input, 'options');
    }
}

export interface Event extends Interface {}
