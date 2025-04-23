import { Define, Interface, SignatureRequirement } from '../declarations';
import { SourceOrigin, Ident } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'GetAvailableSourcesRequest' })
export class Request extends SignatureRequirement {
    public origin: SourceOrigin;

    constructor(input: { origin: SourceOrigin }) {
        super();
        validator.isObject(input);
        this.origin =
            typeof input.origin === 'string' ? input.origin : validator.getAsObj(input, 'origin');
    }
}
export interface Request extends Interface {}

@Define({ name: 'GetAvailableSourcesResponse' })
export class Response extends SignatureRequirement {
    public list: Ident[];

    constructor(input: { list: Ident[] }) {
        super();
        validator.isObject(input);
        this.list = validator.getAsArray(input, 'list');
    }
}

export interface Response extends Interface {}
