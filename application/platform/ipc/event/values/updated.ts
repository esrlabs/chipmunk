import { Define, Interface, SignatureRequirement } from '../declarations';
import { SearchValuesResult } from '../../../types/filter';

import * as validator from '../../../env/obj';

@Define({ name: 'SearchValuesUpdated' })
export class Event extends SignatureRequirement {
    public session: string;
    public values: SearchValuesResult | null;

    constructor(input: { session: string; values: SearchValuesResult | null }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.values = validator.getAsMapOrNull(input, 'values');
    }
}

export interface Event extends Interface {}
