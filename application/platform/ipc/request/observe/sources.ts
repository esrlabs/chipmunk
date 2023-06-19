import { Define, Interface, SignatureRequirement } from '../declarations';
import { ISourceLink } from '../../../types/observe/types/index';

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
    public sources: ISourceLink[];

    constructor(input: { session: string; sources: ISourceLink[] }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.sources = validator.getAsArray<ISourceLink>(input, 'sources');
    }
}

export interface Response extends Interface {}
