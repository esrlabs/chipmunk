import { Define, Interface, SignatureRequirement } from '../declarations';
import { IGrabbedElement } from '../../../types/content';

import * as validator from '../../../env/obj';

@Define({ name: 'IndexedChunkRequest' })
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

@Define({ name: 'IndexedChunkResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public rows: IGrabbedElement[];
    public from: number;
    public to: number;
    constructor(input: { session: string; from: number; to: number; rows: IGrabbedElement[] }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.from = validator.getAsValidNumber(input, 'from');
        this.to = validator.getAsValidNumber(input, 'to');
        this.rows = validator.getAsArray<IGrabbedElement>(input, 'rows');
    }
}

export interface Response extends Interface {}
