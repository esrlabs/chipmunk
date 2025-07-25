import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';
import { LoadingCancelledEvent } from '../../../types/components';

@Define({ name: 'EmitComponentsLoadingCancelledEvent' })
export class Event extends SignatureRequirement {
    public event: LoadingCancelledEvent;

    constructor(input: { event: LoadingCancelledEvent }) {
        super();
        validator.isObject(input);
        this.event = validator.getAsObj(input, 'event');
    }
}

export interface Event extends Interface {}
