import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'AddGitHubRepoRequest' })
export class Request extends SignatureRequirement {
    public owner: string;
    public repo: string;
    public token: string;
    public branch: string;

    constructor(input: { branch: string; token: string; repo: string; owner: string }) {
        super();
        validator.isObject(input);
        this.token = validator.getAsNotEmptyString(input, 'token');
        this.repo = validator.getAsNotEmptyString(input, 'repo');
        this.owner = validator.getAsNotEmptyString(input, 'owner');
        this.branch = validator.getAsNotEmptyString(input, 'branch');
    }
}
export interface Request extends Interface {}

@Define({ name: 'AddGitHubRepoResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public uuid?: string;

    constructor(input: { uuid?: string; error?: string }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyStringOrAsUndefined(input, 'uuid');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
