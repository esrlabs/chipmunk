import { Define, Interface, SignatureRequirement } from '../declarations';
import { NearestPosition } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'NearestRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public row: number;

    constructor(input: { session: string; row: number }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.row = validator.getAsValidNumber(input, 'row');
    }
}

export interface Request extends Interface {}

@Define({ name: 'NearestResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public nearest: NearestPosition | undefined;

    constructor(input: { session: string; nearest: NearestPosition | undefined }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.nearest = validator.getAsObjOrUndefined(input, 'nearest');
    }
}

export interface Response extends Interface {}
