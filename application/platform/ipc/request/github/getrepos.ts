import { Define, Interface, SignatureRequirement } from '../declarations';
import { GitHubRepo, validateGitHubRepo } from '../../../types/github';

import * as validator from '../../../env/obj';

@Define({ name: 'GetGitHubReposRequest' })
export class Request extends SignatureRequirement {
    constructor() {
        super();
    }
}
export interface Request extends Interface {}

@Define({ name: 'GetGitHubRepoResponse' })
export class Response extends SignatureRequirement {
    public repos: GitHubRepo[];

    constructor(input: { repos: GitHubRepo[] }) {
        super();
        validator.isObject(input);
        this.repos = validator.getAsArray(input, 'repos');
        this.repos.forEach((repo) => validateGitHubRepo(repo));
    }
}

export interface Response extends Interface {}
