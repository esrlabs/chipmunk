import * as validator from '../../env/obj';

export interface GitHubRepo {
    uuid: string;
    token: string;
    repo: string;
    owner: string;
    branch: string;
}

export function validateGitHubRepo(repo: GitHubRepo): GitHubRepo {
    validator.isObject(repo);
    repo.token = validator.getAsNotEmptyString(repo, 'token');
    repo.repo = validator.getAsNotEmptyString(repo, 'repo');
    repo.owner = validator.getAsNotEmptyString(repo, 'owner');
    repo.uuid = validator.getAsNotEmptyString(repo, 'uuid');
    return repo;
}
