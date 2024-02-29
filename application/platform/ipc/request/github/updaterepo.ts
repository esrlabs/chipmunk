import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'UpdateGitHubRepoRequest' })
export class Request extends SignatureRequirement {
    public uuid: string;
    public owner: string;
    public repo: string;
    public token: string;
    public branch: string;

    constructor(input: {
        branch: string;
        uuid: string;
        token: string;
        repo: string;
        owner: string;
    }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyString(input, 'uuid');
        this.token = validator.getAsNotEmptyString(input, 'token');
        this.repo = validator.getAsNotEmptyString(input, 'repo');
        this.owner = validator.getAsNotEmptyString(input, 'owner');
        this.branch = validator.getAsNotEmptyString(input, 'branch');
    }
}
export interface Request extends Interface {}

@Define({ name: 'UpdateGitHubRepoResponse' })
export class Response extends SignatureRequirement {
    public error?: string;

    constructor(input: { error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
