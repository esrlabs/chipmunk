import { Define, Interface, SignatureRequirement } from '../declarations';
import { Level } from '../../../log';

import * as validator from '../../../env/obj';

@Define({ name: 'WriteLogMessage' })
export class Event extends SignatureRequirement {
    public message: string;
    public level: Level;

    constructor(input: { message: string; level: Level }) {
        super();
        validator.isObject(input);
        this.message = validator.getAsNotEmptyString(input, 'message');
        this.level = validator.getAsNotEmptyString(input, 'level') as Level;
    }
}

export interface Event extends Interface {}
