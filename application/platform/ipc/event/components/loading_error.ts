import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';
import { LoadingErrorEvent } from '../../../types/components';

@Define({ name: 'EmitComponentsLoadingErrorEvent' })
export class Event extends SignatureRequirement {
    public event: LoadingErrorEvent;

    constructor(input: { event: LoadingErrorEvent }) {
        super();
        validator.isObject(input);
        this.event = validator.getAsObj(input, 'event');
    }
}

export interface Event extends Interface {}
