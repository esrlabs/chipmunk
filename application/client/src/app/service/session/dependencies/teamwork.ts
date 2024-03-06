import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { cutUuid } from '@log/index';
import { Observe } from '@platform/types/observe';
import { GitHubRepo } from '@platform/types/github';
import { FileMetaDataDefinition } from '@platform/types/github/filemetadata';
import { Session } from '@service/session';
import { FileDesc } from '@service/history/definition.file';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { StoredEntity } from '@service/session/dependencies/search/store';

import * as utils from '@platform/log/utils';
import * as Requests from '@platform/ipc/request';

@SetupLogger()
export class TeamWork extends Subscriber {
    protected readonly subs: Subscriber = new Subscriber();
    protected readonly repos: Map<string, GitHubRepo> = new Map();
    protected readonly active: {
        repo: GitHubRepo | undefined;
        username: string | undefined;
    } = {
        repo: undefined,
        username: undefined,
    };
    protected session!: Session;
    // checksum of opened file
    // string - checksum
    // undefined - not set yet
    // null - cannot be set (stream, multiple files, etc.)
    protected checksum: string | undefined | null = undefined;
    // Last written hash
    // string - hash
    // undefined - not loaded
    // null - no related profile on github repo
    protected previous: string | undefined | null;

    protected hash(metadata?: FileMetaDataDefinition): string {
        if (metadata === undefined) {
            const filters = this.session.search.store().filters().get();
            const charts = this.session.search.store().charts().get();
            const comments = this.session.comments.getAsArray();
            const bookmarks = this.session.bookmarks.get();
            return `${filters
                .map((v) => FilterRequest.getHashByDefinition(v.definition))
                .join(';')}${charts
                .map((v) => ChartRequest.getHashByDefinition(v.definition))
                .join(';')};${JSON.stringify(comments)};${JSON.stringify(bookmarks)}`;
        } else {
            return `${metadata.filters
                .map((v) => FilterRequest.getHashByDefinition(v))
                .join(';')}${metadata.charts
                .map((v) => ChartRequest.getHashByDefinition(v))
                .join(';')};${JSON.stringify(metadata.comments)};${JSON.stringify(
                metadata.bookmarks,
            )}`;
        }
    }

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
                this.active.repo = this.repos.get(active.uuid);
            }
            if (this.active.repo !== undefined) {
                this.user().reload();
            }
            this.subjects.get().loaded.emit();
            this.subjects.get().active.emit(this.active.repo);
            this.file().check();
        } catch (err) {
            this.log().error(`Fail to load available GitHub references: ${utils.error(err)}`);
        }
    }

    protected metadata(): {
        import(md: FileMetaDataDefinition): void;
    } {
        return {
            import: (md: FileMetaDataDefinition): void => {
                const local = this.hash();
                this.previous = this.hash(md);
                if (local === this.previous) {
                    return;
                }
                this.events().unsubscribe();
                this.session.search
                    .store()
                    .filters()
                    .overwrite(
                        md.filters.map(
                            (def) => new FilterRequest(def),
                        ) as StoredEntity<FilterRequest>[],
                    );
                this.session.search
                    .store()
                    .charts()
                    .overwrite(
                        md.charts.map(
                            (def) => new ChartRequest(def),
                        ) as StoredEntity<ChartRequest>[],
                    );
                this.session.search.store().filters().refresh();
                this.session.comments.set(md.comments);
                this.session.bookmarks.overwriteFromDefs(md.bookmarks);
                setTimeout(() => {
                    this.subjects.get().metadata.emit(md);
                    this.events().subscribe();
                }, 500);
            },
        };
    }

    protected file(): {
        check(): void;
        write(): void;
    } {
        return {
            check: (): void => {
                if (typeof this.checksum !== 'string' || this.active.repo === undefined) {
                    return;
                }
                Requests.IpcRequest.send(
                    Requests.GitHub.GetFileMeta.Response,
                    new Requests.GitHub.GetFileMeta.Request({
                        checksum: this.checksum,
                    }),
                )
                    .then((response) => {
                        if (response.error !== undefined) {
                            this.log().error(`Fail to get metadata: ${response.error}`);
                        } else if (response.metadata !== undefined) {
                            this.metadata().import(response.metadata);
                        } else {
                            this.previous = null;
                        }
                    })
                    .catch((err: Error) => {
                        this.log().error(`Request error: fail to get metadata: ${err.message}`);
                    });
            },
            write: (): void => {
                if (typeof this.checksum !== 'string' || this.active.repo === undefined) {
                    return;
                }
                if (this.previous === undefined) {
                    // Profile wasn't loaded yet
                    return;
                }
                if (this.hash() === this.previous) {
                    return;
                }
                const filters = this.session.search.store().filters().get();
                const charts = this.session.search.store().charts().get();
                const bookmarks = this.session.bookmarks.get().map((b) => b.asDef());
                const comments = this.session.comments.getAsArray();
                Requests.IpcRequest.send(
                    Requests.GitHub.SetFileMeta.Response,
                    new Requests.GitHub.SetFileMeta.Request({
                        checksum: this.checksum,
                        metadata: {
                            protocol: '0.0.1',
                            filters: filters.map((filter) => filter.definition),
                            charts: charts.map((chart) => chart.definition),
                            bookmarks: bookmarks,
                            comments: comments,
                        },
                    }),
                )
                    .then((response) => {
                        if (response.error !== undefined) {
                            this.log().error(`Fail to save metadata: ${response.error}`);
                        }
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to set active repo: ${err.message}`);
                    });
            },
        };
    }

    protected events(): {
        subscribe(): void;
        unsubscribe(): void;
    } {
        return {
            subscribe: (): void => {
                this.subs.register(
                    this.session.search
                        .store()
                        .filters()
                        .subjects.get()
                        .any.subscribe(() => {
                            this.file().write();
                        }),
                    this.session.search
                        .store()
                        .charts()
                        .subjects.get()
                        .any.subscribe(() => {
                            this.file().write();
                        }),
                    this.session.bookmarks.subjects.get().updated.subscribe(() => {
                        this.file().write();
                    }),
                    this.session.comments.subjects.get().updated.subscribe(() => {
                        this.file().write();
                    }),
                    this.session.comments.subjects.get().added.subscribe(() => {
                        this.file().write();
                    }),
                    this.session.comments.subjects.get().removed.subscribe(() => {
                        this.file().write();
                    }),
                );
            },
            unsubscribe: (): void => {
                this.subs.unsubscribe();
            },
        };
    }

    public readonly subjects: Subjects<{
        loaded: Subject<void>;
        active: Subject<GitHubRepo | undefined>;
        username: Subject<string | undefined>;
        metadata: Subject<FileMetaDataDefinition>;
    }> = new Subjects({
        loaded: new Subject<void>(),
        active: new Subject<GitHubRepo | undefined>(),
        username: new Subject<string | undefined>(),
        metadata: new Subject<FileMetaDataDefinition>(),
    });

    public init(session: Session) {
        this.setLoggerName(`TeamWork: ${cutUuid(session.uuid())}`);
        this.session = session;
        this.load().catch((err: Error) => {
            this.log().error(`Loading error: ${err.message}`);
        });
        this.register(
            this.session.stream.subjects.get().started.subscribe((observe: Observe) => {
                if (this.checksum === null) {
                    return;
                }
                FileDesc.fromDataSource(observe)
                    .then((desc) => {
                        if (desc === undefined) {
                            this.checksum = null;
                        } else if (this.checksum === undefined) {
                            this.checksum = desc.checksum;
                            this.file().check();
                        } else {
                            this.checksum = null;
                        }
                    })
                    .catch((err: Error) => {
                        this.checksum = null;
                        this.log().error(`Fail get chechsum of file: ${err.message}`);
                    });
            }),
        );
        this.events().subscribe();
    }

    public destroy() {
        this.unsubscribe();
        this.events().unsubscribe();
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
                            this.active.repo = repo;
                            this.subjects.get().active.emit(repo);
                            this.file().check();
                            this.user().reload();
                        }
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to set active repo: ${err.message}`);
                    });
            },
            getActive: (): GitHubRepo | undefined => {
                return this.active.repo;
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
                        this.active.repo = repo;
                        this.repos.set(repo.uuid, repo);
                        this.subjects.get().loaded.emit();
                        this.subjects.get().active.emit(this.active.repo);
                        this.file().check();
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

    public user(): {
        reload(): void;
        get(): string | undefined;
    } {
        return {
            reload: (): void => {
                if (this.active.repo === undefined) {
                    return;
                }
                Requests.IpcRequest.send(
                    Requests.GitHub.GetUserName.Response,
                    new Requests.GitHub.GetUserName.Request(),
                )
                    .then((response) => {
                        if (response.error !== undefined || response.username === undefined) {
                            this.log().error(
                                `Fail to get username: ${
                                    response.error === undefined ? '' : response.error
                                }`,
                            );
                            this.active.username = undefined;
                        } else if (response.username !== undefined) {
                            this.active.username = response.username;
                        }
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to get username: ${err.message}`);
                        this.active.username = undefined;
                    })
                    .finally(() => {
                        this.subjects.get().username.emit(this.active.username);
                    });
            },
            get: (): string | undefined => {
                return this.active.username;
            },
        };
    }
}
export interface TeamWork extends LoggerInterface {}
