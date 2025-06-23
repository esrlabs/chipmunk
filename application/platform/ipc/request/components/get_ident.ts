import { Define, Interface, SignatureRequirement } from '../declarations';
import { FieldDesc, Ident, SessionAction } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'GetIdentRequest' })
export class Request extends SignatureRequirement {
    public target: string;

    constructor(input: { target: string }) {
        super();
        validator.isObject(input);
        this.target = validator.getAsNotEmptyString(input, 'target');
    }
}
export interface Request extends Interface {}

@Define({ name: 'GetIdentResponse' })
export class Response extends SignatureRequirement {
    public ident: Ident | undefined;

    constructor(input: { ident: Ident | undefined }) {
        super();
        validator.isObject(input);
        this.ident = validator.getAsObjOrUndefined(input, 'ident');
    }
}

export interface Response extends Interface {}
