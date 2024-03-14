import { GitHubRepo } from 'platform/types/github';
import { Queue } from 'platform/env/runner';

export abstract class Request<T> {
    protected abstract executor(): Promise<T>;

    constructor(protected readonly queue: Queue, protected readonly options: GitHubRepo) {}
    public send(): Promise<T> {
        return this.queue.wait<T>(this.executor.bind(this));
    }
    public getHeaders(): { [key: string]: string } {
        return {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${this.options.token}`,
            'X-GitHub-Api-Version': '2022-11-28',
        };
    }
}
