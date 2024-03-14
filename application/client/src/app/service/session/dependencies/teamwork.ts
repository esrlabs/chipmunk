import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { cutUuid } from '@log/index';
import { Observe } from '@platform/types/observe';
import { GitHubRepo } from '@platform/types/github';
import { FileMetaDataDefinition, FileMetaData } from '@platform/types/github/filemetadata';
import { Session } from '@service/session';
import { FileDesc } from '@service/history/definition.file';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { ChangeEvent, StoredEntity } from '@service/session/dependencies/search/store';
import { history } from '@service/history';
import { LockToken } from '@platform/env/lock.token';

import * as utils from '@platform/log/utils';
import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';
import * as moment from 'moment';

export interface GitHubError {
    time: string;
    msg: string;
}

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
    // undefined - not loaded or no related profile on github repo
    protected recent: {
        metadata: FileMetaData | undefined;
        sha: string | undefined;
    } = {
        metadata: undefined,
        sha: undefined,
    };
    protected errors: GitHubError[] = [];
    protected destroyed: boolean = false;
    protected blocked: string[] = [];
    protected listener: LockToken = new LockToken(true);

    protected getLocalMetadata(): FileMetaData {
        const filters = this.session.search.store().filters().get();
        const charts = this.session.search.store().charts().get();
        const bookmarks = this.session.bookmarks.get().map((b) => b.asDef());
        const comments = this.session.comments.getAsArray();
        return new FileMetaData({
            protocol: '0.0.1',
            filters: filters.map((filter) => filter.definition),
            charts: charts.map((chart) => chart.definition),
            bookmarks: bookmarks,
            comments: comments,
        });
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
            this.error().add(`Fail to load available GitHub references: ${utils.error(err)}`);
        }
    }

    protected metadata(): {
        import(md: FileMetaDataDefinition, sha: string): void;
    } {
        return {
            import: (md: FileMetaDataDefinition, sha: string): void => {
                if (this.active.repo === undefined || this.destroyed) {
                    return;
                }
                const local = this.recent.metadata;
                const recent = new FileMetaData(md);
                this.recent.metadata = recent;
                this.recent.sha = sha;
                if (
                    local !== undefined &&
                    local !== null &&
                    local.hash().equal(this.active.repo.settings, recent)
                ) {
                    return;
                }
                this.active.repo.settings.filters &&
                    this.events().wait(
                        this.session.search
                            .store()
                            .filters()
                            .overwrite(
                                md.filters.map(
                                    (def) => new FilterRequest(def),
                                ) as StoredEntity<FilterRequest>[],
                            ),
                    );
                this.active.repo.settings.charts &&
                    this.events().wait(
                        this.session.search
                            .store()
                            .charts()
                            .overwrite(
                                md.charts.map(
                                    (def) => new ChartRequest(def),
                                ) as StoredEntity<ChartRequest>[],
                            ),
                    );
                this.active.repo.settings.comments && this.session.comments.set(md.comments);
                if (this.active.repo.settings.bookmarks) {
                    this.session.bookmarks
                        .overwriteFromDefs(md.bookmarks)
                        .catch((err: Error) => {
                            this.log().error(`Fail update bookmarks due: ${err.message}`);
                        })
                        .finally(() => {
                            this.subjects.get().metadata.emit(md);
                        });
                } else {
                    this.subjects.get().metadata.emit(md);
                }
            },
        };
    }

    protected file(): {
        check(sha?: string): void;
        checkUpdates(): void;
        write(): void;
    } {
        return {
            check: (sha?: string): void => {
                if (
                    typeof this.checksum !== 'string' ||
                    this.active.repo === undefined ||
                    this.destroyed
                ) {
                    return;
                }
                Requests.IpcRequest.send(
                    Requests.GitHub.GetFileMeta.Response,
                    new Requests.GitHub.GetFileMeta.Request({
                        checksum: this.checksum,
                        sha,
                    }),
                )
                    .then((response) => {
                        if (response.error !== undefined) {
                            this.error().add(`Fail to get metadata: ${response.error}`);
                        } else if (response.metadata !== undefined && response.sha !== undefined) {
                            this.metadata().import(response.metadata, response.sha);
                        } else {
                            this.recent.metadata = undefined;
                            this.recent.sha = undefined;
                        }
                    })
                    .catch((err: Error) => {
                        this.error().add(`Request error: fail to get metadata: ${err.message}`);
                    });
            },
            checkUpdates: (): void => {
                if (
                    typeof this.checksum !== 'string' ||
                    this.active.repo === undefined ||
                    this.destroyed
                ) {
                    return;
                }
                Requests.IpcRequest.send(
                    Requests.GitHub.CheckUpdates.Response,
                    new Requests.GitHub.CheckUpdates.Request({
                        checksum: this.checksum,
                    }),
                )
                    .then((response) => {
                        if (response.error !== undefined) {
                            this.error().add(
                                `Fail to check for updates of metadata: ${response.error}`,
                            );
                        }
                    })
                    .catch((err: Error) => {
                        this.error().add(
                            `Request error: fail to check for updates of metadata: ${err.message}`,
                        );
                    });
            },
            write: (): void => {
                if (
                    typeof this.checksum !== 'string' ||
                    this.active.repo === undefined ||
                    this.recent.sha === undefined ||
                    this.destroyed
                ) {
                    return;
                }
                const metadata = this.getLocalMetadata();
                if (
                    this.recent.metadata !== undefined &&
                    metadata.hash().equal(this.active.repo.settings, this.recent.metadata)
                ) {
                    // Last time was written same metadata object
                    return;
                }
                Requests.IpcRequest.send(
                    Requests.GitHub.SetFileMeta.Response,
                    new Requests.GitHub.SetFileMeta.Request({
                        checksum: this.checksum,
                        metadata: metadata.def,
                        sha: this.recent.sha,
                    }),
                )
                    .then((response) => {
                        if (response.error !== undefined) {
                            this.error().add(`Fail to save metadata: ${response.error}`);
                        } else {
                            this.recent.sha = response.sha;
                        }
                    })
                    .catch((err: Error) => {
                        this.error().add(`Fail to set active repo: ${err.message}`);
                    });
            },
        };
    }

    protected events(): {
        ignored(sequence: string): boolean;
        wait(sequence: string): void;
    } {
        return {
            ignored: (sequence: string): boolean => {
                if (this.blocked.includes(sequence)) {
                    this.blocked = this.blocked.filter((s) => s !== sequence);
                    return true;
                }
                return false;
            },
            wait: (sequence: string): void => {
                this.blocked.push(sequence);
            },
        };
    }

    public readonly subjects: Subjects<{
        loaded: Subject<void>;
        active: Subject<GitHubRepo | undefined>;
        username: Subject<string | undefined>;
        metadata: Subject<FileMetaDataDefinition>;
        error: Subject<void>;
    }> = new Subjects({
        loaded: new Subject<void>(),
        active: new Subject<GitHubRepo | undefined>(),
        username: new Subject<string | undefined>(),
        metadata: new Subject<FileMetaDataDefinition>(),
        error: new Subject<void>(),
    });

    public init(session: Session) {
        this.setLoggerName(`TeamWork: ${cutUuid(session.uuid())}`);
        this.session = session;
        this.load().catch((err: Error) => {
            this.error().add(`Loading error: ${err.message}`);
        });

        this.register(
            Events.IpcEvent.subscribe(
                Events.GitHub.FileUpdated.Event,
                (event: Events.GitHub.FileUpdated.Event) => {
                    this.file().check(event.sha);
                },
            ),
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
                        this.error().add(`Fail get chechsum of file: ${err.message}`);
                    });
            }),
            history.subjects.get().created.subscribe((uuid: string) => {
                const session = history.get(uuid);
                if (session === undefined) {
                    this.log().error(`Fail to get access to history session`);
                    return;
                }
                if (session.check().done()) {
                    this.listener.unlock();
                } else {
                    this.register(
                        session.subjects.get().checked.subscribe(() => {
                            this.listener.unlock();
                        }),
                    );
                }
            }),
            this.session.search
                .store()
                .filters()
                .subjects.get()
                .any.subscribe((event: ChangeEvent<FilterRequest>) => {
                    if (this.listener.isLocked() || this.events().ignored(event.sequence)) {
                        return;
                    }
                    this.file().write();
                }),
            this.session.search
                .store()
                .charts()
                .subjects.get()
                .any.subscribe((event: ChangeEvent<ChartRequest>) => {
                    if (this.listener.isLocked() || this.events().ignored(event.sequence)) {
                        return;
                    }
                    this.file().write();
                }),
            this.session.bookmarks.subjects.get().updated.subscribe((sequence: string) => {
                if (this.listener.isLocked() || this.events().ignored(sequence)) {
                    return;
                }
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
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
        this.destroyed = true;
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
                            this.error().add(`Fail to save active: ${response.error}`);
                        } else {
                            this.active.repo = repo;
                            this.subjects.get().active.emit(repo);
                            this.file().check();
                            this.user().reload();
                        }
                    })
                    .catch((err: Error) => {
                        this.error().add(`Fail to set active repo: ${err.message}`);
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
                            this.error().add(`Fail to add new repo: ${response.error}`);
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
                        this.error().add(`Fail to add new GitHub references: ${err.message}`);
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
                            this.error().add(`Fail to update new repo: ${response.error}`);
                            return Promise.reject(new Error(response.error));
                        }
                        this.recent.metadata = undefined;
                        this.recent.sha = undefined;
                        this.repos.set(repo.uuid, repo);
                        this.subjects.get().loaded.emit();
                        //TODO: change workflow here; we should reload metadata
                        return Promise.resolve();
                    })
                    .catch((err: Error) => {
                        this.error().add(`Fail to update GitHub references: ${err.message}`);
                    });
            },
            delete: async (uuid: string): Promise<void> => {
                if (!this.repos.has(uuid)) {
                    return Promise.reject(new Error(`Github reference doesn't exist`));
                }
                if (this.active.repo !== undefined && this.active.repo.uuid === uuid) {
                    await this.repo().setActive(undefined);
                }
                return Requests.IpcRequest.send(
                    Requests.GitHub.RemoveRepo.Response,
                    new Requests.GitHub.RemoveRepo.Request({ uuid }),
                )
                    .then((response: Requests.GitHub.RemoveRepo.Response) => {
                        if (response.error !== undefined) {
                            this.error().add(`Fail to remove new repo: ${response.error}`);
                            return Promise.reject(new Error(response.error));
                        }
                        return this.load();
                    })
                    .catch((err: Error) => {
                        this.error().add(`Fail to update GitHub references: ${err.message}`);
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
                if (this.active.repo === undefined || this.destroyed) {
                    return;
                }
                Requests.IpcRequest.send(
                    Requests.GitHub.GetUserName.Response,
                    new Requests.GitHub.GetUserName.Request(),
                )
                    .then((response) => {
                        if (response.error !== undefined || response.username === undefined) {
                            this.error().add(
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
                        this.error().add(`Fail to get username: ${err.message}`);
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

    public error(): {
        add(msg: string): void;
        get(): GitHubError[];
        clear(): void;
    } {
        return {
            add: (msg: string): void => {
                this.log().error(msg);
                this.errors.push({
                    time: moment.unix(Date.now() / 1000).format('MM/DD/YYYY hh:mm:ss'),
                    msg,
                });
                this.subjects.get().error.emit();
                this.session.switch().sidebar.teamwork();
            },
            get: (): GitHubError[] => {
                return this.errors;
            },
            clear: (): void => {
                this.errors = [];
                this.subjects.get().error.emit();
            },
        };
    }

    public update() {
        this.file().checkUpdates();
    }
}
export interface TeamWork extends LoggerInterface {}
