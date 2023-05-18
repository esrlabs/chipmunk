import { Define, Interface, SignatureRequirement } from '../declarations';
import { IValuesMinMaxMap } from '../../../interfaces/interface.rust.api.general';

import * as validator from '../../../env/obj';

@Define({ name: 'SearchValuesUpdated' })
export class Event extends SignatureRequirement {
    public session: string;
    public map: IValuesMinMaxMap | null;

    constructor(input: { session: string; map: IValuesMinMaxMap | null }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.map = validator.getAsObjOrUndefined(input, 'map', null);
    }
}

export interface Event extends Interface {}
