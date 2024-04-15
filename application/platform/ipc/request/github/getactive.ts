import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'GetActiveGitHubRepoRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'GetActiveGitHubRepoResponse' })
export class Response extends SignatureRequirement {
    public uuid: string | undefined;

    constructor(input: { uuid: string | undefined }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyStringOrAsUndefined(input, 'uuid');
    }
}

export interface Response extends Interface {}
