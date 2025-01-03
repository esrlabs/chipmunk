import { Define, Interface, SignatureRequirement } from '../declarations';
import { GrabbedElement } from '../../../types/bindings/miscellaneous';

import * as validator from '../../../env/obj';

@Define({ name: 'StreamChunkRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public from: number;
    public to: number;

    constructor(input: { session: string; from: number; to: number }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.from = validator.getAsValidNumber(input, 'from');
        this.to = validator.getAsValidNumber(input, 'to');
    }
}

export interface Request extends Interface {}

@Define({ name: 'StreamChunkResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public rows: GrabbedElement[];
    public from: number;
    public to: number;
    constructor(input: { session: string; from: number; to: number; rows: GrabbedElement[] }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.from = validator.getAsValidNumber(input, 'from');
        this.to = validator.getAsValidNumber(input, 'to');
        this.rows = validator.getAsArray<GrabbedElement>(input, 'rows');
    }
}

export interface Response extends Interface {}
