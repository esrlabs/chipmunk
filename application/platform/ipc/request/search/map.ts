import { Define, Interface, SignatureRequirement } from '../declarations';
import { ISearchMap } from '../../../interfaces/interface.rust.api.general';

import * as validator from '../../../env/obj';

@Define({ name: 'MapRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public len: number;
    public from?: number;
    public to?: number;

    constructor(input: {
        session: string;
        len: number;
        from: number | undefined;
        to: number | undefined;
    }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.len = validator.getAsValidNumber(input, 'len');
        this.from = validator.getAsValidNumberOrUndefined(input, 'from');
        this.to = validator.getAsValidNumberOrUndefined(input, 'to');
    }
}

export interface Request extends Interface {}

@Define({ name: 'MapResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public map: ISearchMap;
    public from: number;
    public to: number;
    
    constructor(input: { session: string; map: ISearchMap; from: number; to: number }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.map = validator.getAsArray(input, 'map');
        this.from = validator.getAsValidNumber(input, 'from');
        this.to = validator.getAsValidNumber(input, 'to');
    }
}

export interface Response extends Interface {}
