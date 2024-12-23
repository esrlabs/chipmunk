import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'SearchValuesUpdated' })
export class Event extends SignatureRequirement {
    public session: string;
    public map: Map<number, [number, number]> | null;

    constructor(input: { session: string; map: Map<number, [number, number]> | null }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.map = validator.getAsObjOrUndefined(input, 'map', null);
    }
}

export interface Event extends Interface {}
