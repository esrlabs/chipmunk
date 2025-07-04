import { Define, Interface, SignatureRequirement } from '../declarations';
import { Ident } from '../../../types/bindings/observe';

import * as validator from '../../../env/obj';

@Define({ name: 'StreamActionRequest' })
export class Request extends SignatureRequirement {
    public parser?: Ident;
    public source?: Ident;

    constructor(input: { parser: Ident | undefined; source: Ident | undefined }) {
        super();
        validator.isObject(input);
        this.parser = validator.getAsObjOrUndefined(input, 'parser');
        this.source = validator.getAsObjOrUndefined(input, 'source');
    }
}
export interface Request extends Interface {}

@Define({ name: 'StreamActionResponse' })
export class Response extends SignatureRequirement {
    public error: string | undefined;

    constructor(input: { error: string | undefined }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
