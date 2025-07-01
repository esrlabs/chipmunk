import { Define, Interface, SignatureRequirement } from '../declarations';
import { SessionDescriptor } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'SessionDescriptorUpdated' })
export class Event extends SignatureRequirement {
    public descriptor: SessionDescriptor;
    public operation: string;
    public session: string;

    constructor(input: { descriptor: SessionDescriptor; session: string; operation: string }) {
        super();
        validator.isObject(input);
        this.descriptor = validator.getAsObj(input, 'descriptor');
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.operation = validator.getAsNotEmptyString(input, 'operation');
    }
}

export interface Event extends Interface {}
