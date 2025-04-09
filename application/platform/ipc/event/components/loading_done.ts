import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';
import { LoadingDoneEvent } from '../../../types/components';

@Define({ name: 'EmitComponentsLoadingFieldsDone' })
export class Event extends SignatureRequirement {
    public event: LoadingDoneEvent;

    constructor(input: { event: LoadingDoneEvent }) {
        super();
        validator.isObject(input);
        this.event = validator.getAsObj(input, 'event');
    }
}

export interface Event extends Interface {}
