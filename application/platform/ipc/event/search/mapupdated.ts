import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'SearchMapUpdated' })
export class Event extends SignatureRequirement {
    public session: string;
    public map: string | null;

    constructor(input: { session: string; map: string | null }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.map = validator.getAsStringOrNull(input, 'map');
    }
}

export interface Event extends Interface {}
