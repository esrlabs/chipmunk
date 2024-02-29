import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { cutUuid } from '@log/index';
import { lockers } from '@ui/service/lockers';
import { GitHubRepo } from '@platform/types/github';
import { Session } from '@service/session';
import * as utils from '@platform/log/utils';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

@SetupLogger()
export class TeamWork extends Subscriber {
    public readonly subjects: Subjects<{
        loaded: Subject<void>;
        active: Subject<GitHubRepo | undefined>;
    }> = new Subjects({
        loaded: new Subject<void>(),
        active: new Subject<GitHubRepo | undefined>(),
    });
    protected repos: Map<string, GitHubRepo> = new Map();
    protected active: GitHubRepo | undefined;
    protected session!: Session;

    protected async load(): Promise<void> {
        try {
            const repos = await Requests.IpcRequest.send(
                Requests.GitHub.GetRepos.Response,
                new Requests.GitHub.GetRepos.Request(),
            );
            const active = await Requests.IpcRequest.send(
                Requests.GitHub.GetActive.Response,
                new Requests.GitHub.GetActive.Request(),
            );
            this.repos.clear();
            repos.repos.forEach((repo: GitHubRepo) => {
                this.repos.set(repo.uuid, repo);
            });
            if (active.uuid !== undefined) {
                this.active = this.repos.get(active.uuid);
            }
            this.subjects.get().loaded.emit();
            this.subjects.get().active.emit(this.active);
        } catch (err) {
            this.log().error(`Fail to load available GitHub references: ${utils.error(err)}`);
        }
    }

    public init(session: Session) {
        this.setLoggerName(`TeamWork: ${cutUuid(session.uuid())}`);
        this.session = session;
        this.load().catch((err: Error) => {
            this.log().error(`Loading error: ${err.message}`);
        });
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
    }

    public repo(): {
        list(): GitHubRepo[];
        setActive(repo: GitHubRepo | undefined): void;
        getActive(): GitHubRepo | undefined;
        create(repo: GitHubRepo): Promise<void>;
        update(repo: GitHubRepo): Promise<void>;
        delete(uuid: string): Promise<void>;
        reload(): Promise<void>;
    } {
        return {
            list: (): GitHubRepo[] => {
                return Array.from(this.repos.values());
            },
            setActive: (repo: GitHubRepo | undefined): void => {
                Requests.IpcRequest.send(
                    Requests.GitHub.SetActive.Response,
                    new Requests.GitHub.SetActive.Request({
                        uuid: repo === undefined ? undefined : repo.uuid,
                    }),
                )
                    .then((response) => {
                        if (response.error !== undefined) {
                            this.log().error(`Fail to save active: ${response.error}`);
                        } else {
                            this.active = repo;
                            this.subjects.get().active.emit(undefined);
                        }
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to set active repo: ${err.message}`);
                    });
            },
            getActive: (): GitHubRepo | undefined => {
                return this.active;
            },
            create: (repo: GitHubRepo): Promise<void> => {
                return Requests.IpcRequest.send(
                    Requests.GitHub.AddRepo.Response,
                    new Requests.GitHub.AddRepo.Request(repo),
                )
                    .then((response: Requests.GitHub.AddRepo.Response) => {
                        if (response.error !== undefined) {
                            this.log().error(`Fail to add new repo: ${response.error}`);
                            return Promise.reject(new Error(response.error));
                        }
                        if (response.uuid === undefined) {
                            return Promise.reject(new Error(`No uuid for added repo`));
                        }
                        repo.uuid = response.uuid;
                        this.active = repo;
                        this.repos.set(repo.uuid, repo);
                        this.subjects.get().loaded.emit();
                        this.subjects.get().active.emit(this.active);
                        return Promise.resolve();
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to add new GitHub references: ${err.message}`);
                    });
            },
            update: (repo: GitHubRepo): Promise<void> => {
                if (!this.repos.has(repo.uuid)) {
                    return Promise.reject(new Error(`Github reference doesn't exist`));
                }
                return Requests.IpcRequest.send(
                    Requests.GitHub.UpdateRepo.Response,
                    new Requests.GitHub.UpdateRepo.Request(repo),
                )
                    .then((response: Requests.GitHub.UpdateRepo.Response) => {
                        if (response.error !== undefined) {
                            this.log().error(`Fail to update new repo: ${response.error}`);
                            return Promise.reject(new Error(response.error));
                        }
                        this.repos.set(repo.uuid, repo);
                        this.subjects.get().loaded.emit();
                        return Promise.resolve();
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to update GitHub references: ${err.message}`);
                    });
            },
            delete: (uuid: string): Promise<void> => {
                if (!this.repos.has(uuid)) {
                    return Promise.reject(new Error(`Github reference doesn't exist`));
                }
                return Requests.IpcRequest.send(
                    Requests.GitHub.RemoveRepo.Response,
                    new Requests.GitHub.RemoveRepo.Request({ uuid }),
                )
                    .then((response: Requests.GitHub.RemoveRepo.Response) => {
                        if (response.error !== undefined) {
                            this.log().error(`Fail to remove new repo: ${response.error}`);
                            return Promise.reject(new Error(response.error));
                        }
                        return this.load();
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to update GitHub references: ${err.message}`);
                    });
            },
            reload: (): Promise<void> => {
                return this.load();
            },
        };
    }
}
export interface TeamWork extends LoggerInterface {}
