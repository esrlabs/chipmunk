import { Define, Interface, SignatureRequirement } from '../declarations';
import { SourceDefinition } from '../../../types/bindings/miscellaneous';

import * as validator from '../../../env/obj';

@Define({ name: 'SourcesListRequest' })
export class Request extends SignatureRequirement {
    public session: string;

    constructor(input: { session: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}

export interface Request extends Interface {}

@Define({ name: 'SourcesListResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public sources: SourceDefinition[];

    constructor(input: { session: string; sources: SourceDefinition[] }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.sources = validator.getAsArray<SourceDefinition>(input, 'sources');
    }
}

export interface Response extends Interface {}
