import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'SetActiveGitHubRepoRequest' })
export class Request extends SignatureRequirement {
    public uuid: string;

    constructor(input: { uuid: string | undefined }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyStringOrAsUndefined(input, 'uuid');
    }
}
export interface Request extends Interface {}

@Define({ name: 'SetActiveGitHubRepoResponse' })
export class Response extends SignatureRequirement {
    public error?: string;

    constructor(input: { error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
