import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'WriteLogMessage' })
export class Event extends SignatureRequirement {
    public message: string;

    constructor(input: { message: string }) {
        super();
        validator.isObject(input);
        this.message = validator.getAsNotEmptyString(input, 'message');
    }
}

export interface Event extends Interface {}
