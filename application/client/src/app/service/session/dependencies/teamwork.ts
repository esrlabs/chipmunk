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
import * as Origins from '@platform/types/observe/origin/index';
import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

@SetupLogger()
export class TeamWork extends Subscriber {
    public readonly subjects: Subjects<{
        loaded: Subject<void>;
        active: Subject<GitHubRepo | undefined>;
        metadata: Subject<FileMetaDataDefinition>;
    }> = new Subjects({
        loaded: new Subject<void>(),
        active: new Subject<GitHubRepo | undefined>(),
        metadata: new Subject<FileMetaDataDefinition>(),
    });
    protected repos: Map<string, GitHubRepo> = new Map();
    protected active: GitHubRepo | undefined;
    protected session!: Session;
    // checksum of opened file
    // string - checksum
    // undefined - not set yet
    // null - cannot be set (stream, multiple files, etc.)
    protected checksum: string | undefined | null = undefined;
    // Last written hash
    protected previous: string | undefined;

    protected hash(metadata?: FileMetaDataDefinition): string {
        if (metadata === undefined) {
            const filters = this.session.search.store().filters().get();
            const charts = this.session.search.store().charts().get();
            return `${filters
                .map((v) => FilterRequest.getHashByDefinition(v.definition))
                .join(';')}${charts
                .map((v) => ChartRequest.getHashByDefinition(v.definition))
                .join(';')}`;
        } else {
            return `${metadata.filters
                .map((v) => FilterRequest.getHashByDefinition(v))
                .join(';')}${metadata.charts
                .map((v) => ChartRequest.getHashByDefinition(v))
                .join(';')}`;
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
                this.active = this.repos.get(active.uuid);
            }
            this.subjects.get().loaded.emit();
            this.subjects.get().active.emit(this.active);
            this.file().write();
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
                this.subjects.get().metadata.emit(md);
            },
        };
    }

    protected file(): {
        check(): void;
        write(): void;
    } {
        return {
            check: (): void => {
                if (typeof this.checksum !== 'string' || this.active === undefined) {
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
                        }
                    })
                    .catch((err: Error) => {
                        this.log().error(`Request error: fail to get metadata: ${err.message}`);
                    });
            },
            write: (): void => {
                if (typeof this.checksum !== 'string' || this.active === undefined) {
                    return;
                }
                if (this.hash() === this.previous) {
                    return;
                }
                const filters = this.session.search.store().filters().get();
                const charts = this.session.search.store().charts().get();
                Requests.IpcRequest.send(
                    Requests.GitHub.SetFileMeta.Response,
                    new Requests.GitHub.SetFileMeta.Request({
                        checksum: this.checksum,
                        metadata: {
                            protocol: '0.0.1',
                            filters: filters.map((filter) => filter.definition),
                            charts: charts.map((chart) => chart.definition),
                            bookmarks: [],
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
            session.search
                .store()
                .filters()
                .subjects.get()
                .any.subscribe(() => {
                    this.file().write();
                }),
            session.search
                .store()
                .charts()
                .subjects.get()
                .any.subscribe(() => {
                    this.file().write();
                }),
        );
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
                            this.file().check();
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
