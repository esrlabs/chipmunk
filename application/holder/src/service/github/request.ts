import { GitHubRepo } from 'platform/types/github';

export abstract class Request<T> {
    constructor(protected readonly options: GitHubRepo) {}
    public abstract send(): Promise<T>;
    public getHeaders(): { [key: string]: string } {
        return {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${this.options.token}`,
            'X-GitHub-Api-Version': '2022-11-28',
        };
    }
}
