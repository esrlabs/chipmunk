import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'EmitHotkey' })
export class Event extends SignatureRequirement {
    public code: string;

    constructor(input: { code: string }) {
        super();
        validator.isObject(input);
        this.code = validator.getAsNotEmptyString(input, 'code');
    }
}

export interface Event extends Interface {}
