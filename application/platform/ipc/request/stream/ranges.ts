import { Define, Interface, SignatureRequirement } from '../declarations';
import { GrabbedElement } from '../../../types/bindings/miscellaneous';
import { IRange } from '../../../types/range';

import * as validator from '../../../env/obj';

@Define({ name: 'StreamRangesChunkRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public ranges: IRange[];

    constructor(input: { session: string; ranges: IRange[] }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.ranges = validator.getAsArray(input, 'ranges');
    }
}

export interface Request extends Interface {}

@Define({ name: 'StreamRangesChunkResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public rows: GrabbedElement[];
    constructor(input: { session: string; rows: GrabbedElement[] }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.rows = validator.getAsArray<GrabbedElement>(input, 'rows');
    }
}

export interface Response extends Interface {}
