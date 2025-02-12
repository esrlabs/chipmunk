import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'ListInvalidPluginsPathsRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'ListInvalidPluginsPathsResponse' })
export class Response extends SignatureRequirement {
    public paths: string[];

    constructor(input: { paths: string[] }) {
        super();
        validator.isObject(input);
        this.paths = validator.getAsArray(input, 'paths');
    }
}

export interface Response extends Interface {}
