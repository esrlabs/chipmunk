import { Define, Interface, SignatureRequirement } from '../declarations';
import { SessionDescriptor } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'SessionDescriptorUpdated' })
export class Event extends SignatureRequirement {
    public descriptor: SessionDescriptor;
    public session: string;

    constructor(input: { descriptor: SessionDescriptor; session: string }) {
        super();
        validator.isObject(input);
        this.descriptor = validator.getAsObj(input, 'descriptor');
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}

export interface Event extends Interface {}
