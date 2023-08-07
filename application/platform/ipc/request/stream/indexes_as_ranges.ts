import { Define, Interface, SignatureRequirement } from '../declarations';
import { IRange } from '../../../types/range';

import * as validator from '../../../env/obj';

@Define({ name: 'IndexesAsRangesRequest' })
export class Request extends SignatureRequirement {
    public session: string;

    constructor(input: { session: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}

export interface Request extends Interface {}

@Define({ name: 'IndexesAsRangesResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public ranges: IRange[];

    constructor(input: { session: string; ranges: IRange[] }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.ranges = validator.getAsArray<IRange>(input, 'ranges');
    }
}

export interface Response extends Interface {}
