import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';
import { LoadingErrorsEvent } from '../../../types/components';

@Define({ name: 'EmitComponentsLoadingErrorsEvent' })
export class Event extends SignatureRequirement {
    public event: LoadingErrorsEvent;

    constructor(input: { event: LoadingErrorsEvent }) {
        super();
        validator.isObject(input);
        this.event = validator.getAsObj(input, 'event');
    }
}

export interface Event extends Interface {}
