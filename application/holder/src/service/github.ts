import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { electron } from '@service/electron';
import { jobs } from '@service/jobs';
import { storage } from '@service/storage';
import { CancelablePromise } from 'platform/env/promise';
import { unique } from 'platform/env/sequence';
import { GitHubRepo, validateGitHubRepo } from 'platform/types/github';
import { FileObject } from './github/requests/getfilecontent';
import { error } from 'platform/log/utils';
import { Queue } from './github/queue';

import * as GitHubAPI from './github/requests/index';
import * as Requests from 'platform/ipc/request';
import * as md from 'platform/types/github/filemetadata';
import * as Events from 'platform/ipc/event';
import * as tools from './github/tools';
import * as obj from 'platform/env/obj';

const STORAGE_KEY = 'github_teamwork';
const STORAGE_REPOS = 'repos';
const STORAGE_ACTIVE = 'active_repo';

interface MetaDataLink {
    metadata: md.FileMetaData;
    file: FileObject;
    username: string;
}

@DependOn(electron)
@DependOn(storage)
@DependOn(jobs)
@SetupService(services['github'])
export class Service extends Implementation {
    protected readonly repos: Map<string, GitHubRepo> = new Map();
    protected active: GitHubRepo | undefined;
    protected username: string | undefined;
    protected queue: Queue = new Queue();
    protected files: Map<string, MetaDataLink> = new Map();

    protected getRecent(filename: string): md.FileMetaData | undefined {
        const recent = this.files.get(filename);
        return recent === undefined ? undefined : recent.metadata;
    }
    protected async getFileMetaData(filename: string): Promise<MetaDataLink | undefined> {
        if (this.active === undefined) {
            throw new Error('No active repo selected');
        }
        const active = Object.assign({}, this.active);
        const file: FileObject | undefined = await new GitHubAPI.GetFileContent.Request(
            this.queue,
            active,
            filename,
        ).send();
        if (file === undefined) {
            return undefined;
        }
        const commit = await new GitHubAPI.GetCommitByFile.Request(
            this.queue,
            active,
            filename,
        ).send();
        const metasrc = md.fromJson(file.content);
        if (metasrc instanceof md.ProtocolError || metasrc instanceof Error) {
            throw metasrc;
        }
        const metadata = new md.FileMetaData(metasrc);
        this.files.set(filename, { file, metadata, username: commit.login });
        return { metadata, file, username: commit.login };
    }
    protected async checkFileMetaData(
        filename: string,
        candidate: md.FileMetaData,
    ): Promise<md.FileMetaData | undefined> {
        if (this.active === undefined) {
            return Promise.resolve(undefined);
        }
        const recent: MetaDataLink | undefined = await this.getFileMetaData(filename);
        if (recent === undefined) {
            // No data on remote
            return Promise.resolve(candidate);
        }
        if (!tools.hasChanges(candidate, this.getRecent(filename), this.active.settings)) {
            // Same data on remote. No needs for updates
            return Promise.resolve(undefined);
            // } else if (this.username !== recent.username) {
            //     return Promise.reject(
            //         new Error(`Changes rejected. File was updated by "${recent.username}"`),
            //     );
        } else {
            return Promise.resolve(
                tools.serialize(candidate, recent.metadata, this.active.settings),
            );
        }
    }
    protected async setFileMetaData(filename: string, metadata: md.FileMetaData): Promise<void> {
        if (this.active === undefined) {
            throw new Error('No active repo selected');
        }
        const candidate = await this.checkFileMetaData(filename, metadata);
        if (candidate === undefined) {
            return Promise.resolve();
        }
        const active = Object.assign({}, this.active);
        const branchSha = await new GitHubAPI.GetBrachSHA.Request(this.queue, active).send();
        const baseTreeSha = (
            await new GitHubAPI.GetCommit.Request(this.queue, active, branchSha).send()
        ).tree.sha;
        const newTreeSha = await new GitHubAPI.CreateTree.Request(this.queue, active, baseTreeSha, {
            path: filename,
            type: 'blob',
            mode: '100644',
            content: candidate.stringify(),
        }).send();
        const newCommitSha = await new GitHubAPI.CreateCommit.Request(this.queue, active, {
            message: new Date().toUTCString(),
            tree: newTreeSha,
            parents: [branchSha],
        }).send();
        await new GitHubAPI.UpdateRef.Request(this.queue, active, {
            sha: newCommitSha,
            force: true,
        }).send();
    }
    protected storage(): {
        load(): void;
        save(): void;
    } {
        return {
            load: (): void => {
                storage.entries
                    .get(STORAGE_KEY)
                    .then((entry) => {
                        this.repos.clear();
                        this.active = undefined;
                        const repos = entry.get(STORAGE_REPOS);
                        const active = entry.get(STORAGE_ACTIVE);
                        if (repos !== undefined) {
                            try {
                                const parsed = JSON.parse(repos.content);
                                if (!(parsed instanceof Array)) {
                                    throw new Error(
                                        `List of repos isn't an Array. Expecting GitHubRepo[]; found: ${typeof parsed}`,
                                    );
                                }
                                parsed.forEach((repo: GitHubRepo) => {
                                    const checked = validateGitHubRepo(repo);
                                    this.repos.set(checked.uuid, checked);
                                });
                            } catch (err) {
                                storage.entries
                                    .delete(STORAGE_KEY, [STORAGE_REPOS])
                                    .catch((err: Error) => {
                                        this.log().error(
                                            `Fail to drop storage for ${STORAGE_ACTIVE}: ${err.message}`,
                                        );
                                    });
                                this.log().error(
                                    `Fail to parse storage: ${error(
                                        err,
                                    )}; settings will be dropped`,
                                );
                            }
                        }
                        if (active !== undefined && active.content.trim() !== '') {
                            this.active = this.repos.get(active.content);
                            if (this.active === undefined) {
                                storage.entries
                                    .delete(STORAGE_KEY, [STORAGE_ACTIVE])
                                    .catch((err: Error) => {
                                        this.log().error(
                                            `Fail to drop storage for ${STORAGE_ACTIVE}: ${err.message}`,
                                        );
                                    });
                                this.log().warn(
                                    `Saved active repo isn't found in a list. Reference will be removed from storage.`,
                                );
                            } else {
                                const active = this.active;
                                this.getUserName(this.active)
                                    .then((username: string) => {
                                        this.username = username;
                                    })
                                    .catch((err: Error) => {
                                        this.log().error(
                                            `Fail get username for ${active.owner}/${active.branch}: ${err.message}`,
                                        );
                                    });
                            }
                        }
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to read storage ${STORAGE_KEY}: ${err.message}`);
                    });
            },
            save: (): void => {
                storage.entries
                    .overwrite(STORAGE_KEY, [
                        {
                            uuid: STORAGE_REPOS,
                            content: JSON.stringify(Array.from(this.repos.values())),
                        },
                        {
                            uuid: STORAGE_ACTIVE,
                            content: this.active === undefined ? '' : this.active.uuid,
                        },
                    ])
                    .catch((err: Error) => {
                        this.log().error(`Fail save data on a disc: ${err.message}`);
                    });
            },
        };
    }
    protected getUserName(repo: GitHubRepo): Promise<string> {
        return new GitHubAPI.GetUserName.Request(this.queue, repo).send();
    }
    public override ready(): Promise<void> {
        this.storage().load();
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.CheckUpdates.Request,
                    (
                        request: Requests.GitHub.CheckUpdates.Request,
                    ): CancelablePromise<Requests.GitHub.CheckUpdates.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            const current = this.files.get(request.checksum);
                            const job = jobs
                                .create({
                                    name: 'github: loading file updates',
                                    icon: 'compare_arrows',
                                    spinner: true,
                                })
                                .start();
                            this.getFileMetaData(request.checksum)
                                .then((response: MetaDataLink | undefined) => {
                                    if (response === undefined) {
                                        resolve(
                                            new Requests.GitHub.CheckUpdates.Response({
                                                exists: false,
                                                updated: false,
                                            }),
                                        );
                                    } else if (
                                        current === undefined ||
                                        current.file.sha !== response.file.sha
                                    ) {
                                        Events.IpcEvent.emit(
                                            new Events.GitHub.FileUpdated.Event({
                                                checksum: request.checksum,
                                                sha: response.file.sha,
                                            }),
                                        );
                                        resolve(
                                            new Requests.GitHub.CheckUpdates.Response({
                                                updated: true,
                                                exists: true,
                                            }),
                                        );
                                    } else {
                                        resolve(
                                            new Requests.GitHub.CheckUpdates.Response({
                                                updated: false,
                                                exists: true,
                                            }),
                                        );
                                    }
                                })
                                .catch((err: Error) => {
                                    resolve(
                                        new Requests.GitHub.CheckUpdates.Response({
                                            error: `Fail to get file's metadata: ${err.message}`,
                                            exists: false,
                                            updated: false,
                                        }),
                                    );
                                })
                                .finally(() => {
                                    job.done();
                                });
                        });
                    },
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.AddRepo.Request,
                    (
                        request: Requests.GitHub.AddRepo.Request,
                    ): CancelablePromise<Requests.GitHub.AddRepo.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            if (
                                Array.from(this.repos.values()).find((repo) => {
                                    repo.owner == request.owner && repo.repo == request.repo;
                                }) !== undefined
                            ) {
                                resolve(
                                    new Requests.GitHub.AddRepo.Response({
                                        error: 'Already exists',
                                    }),
                                );
                            } else {
                                const uuid = unique();
                                this.repos.set(uuid, {
                                    uuid,
                                    repo: request.repo,
                                    owner: request.owner,
                                    token: request.token,
                                    branch: request.branch,
                                    settings: request.settings,
                                });
                                this.storage().save();
                                resolve(new Requests.GitHub.AddRepo.Response({ uuid }));
                            }
                        });
                    },
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.RemoveRepo.Request,
                    (
                        request: Requests.GitHub.RemoveRepo.Request,
                    ): CancelablePromise<Requests.GitHub.RemoveRepo.Response> => {
                        return new CancelablePromise((resolve) => {
                            if (!this.repos.has(request.uuid)) {
                                resolve(
                                    new Requests.GitHub.RemoveRepo.Response({
                                        error: 'Does not exist',
                                    }),
                                );
                            } else {
                                this.repos.delete(request.uuid);
                                if (
                                    this.active !== undefined &&
                                    this.active.uuid === request.uuid
                                ) {
                                    this.active = undefined;
                                }
                                this.storage().save();
                                resolve(
                                    new Requests.GitHub.RemoveRepo.Response({
                                        error: undefined,
                                    }),
                                );
                            }
                        });
                    },
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.UpdateRepo.Request,
                    (
                        request: Requests.GitHub.UpdateRepo.Request,
                    ): CancelablePromise<Requests.GitHub.UpdateRepo.Response> => {
                        return new CancelablePromise((resolve) => {
                            if (!this.repos.has(request.uuid)) {
                                resolve(
                                    new Requests.GitHub.UpdateRepo.Response({
                                        error: 'Does not exist',
                                    }),
                                );
                            } else {
                                const repo = {
                                    uuid: request.uuid,
                                    repo: request.repo,
                                    owner: request.owner,
                                    token: request.token,
                                    branch: request.branch,
                                    settings: request.settings,
                                };
                                this.repos.set(request.uuid, obj.clone(repo));
                                if (
                                    this.active !== undefined &&
                                    this.active.uuid === request.uuid
                                ) {
                                    this.active = repo;
                                }
                                this.storage().save();
                                resolve(
                                    new Requests.GitHub.UpdateRepo.Response({
                                        error: undefined,
                                    }),
                                );
                            }
                        });
                    },
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.SetActive.Request,
                    (
                        request: Requests.GitHub.SetActive.Request,
                    ): CancelablePromise<Requests.GitHub.SetActive.Response> => {
                        return new CancelablePromise((resolve) => {
                            const repo = this.repos.get(request.uuid);
                            if (request.uuid === undefined) {
                                this.active = undefined;
                                this.username = undefined;
                                this.storage().save();
                                resolve(
                                    new Requests.GitHub.SetActive.Response({
                                        error: undefined,
                                    }),
                                );
                            } else if (repo !== undefined) {
                                this.active = repo;
                                this.getUserName(repo)
                                    .then((username: string) => {
                                        this.username = username;
                                        this.storage().save();
                                        resolve(
                                            new Requests.GitHub.SetActive.Response({
                                                error: undefined,
                                            }),
                                        );
                                    })
                                    .catch((err: Error) => {
                                        this.active = undefined;
                                        this.username = undefined;
                                        resolve(
                                            new Requests.GitHub.SetActive.Response({
                                                error: `Fail get username: ${err.message}`,
                                            }),
                                        );
                                    });
                            } else {
                                resolve(
                                    new Requests.GitHub.SetActive.Response({
                                        error: 'Does not exist',
                                    }),
                                );
                            }
                        });
                    },
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.GetActive.Request,
                    (
                        _request: Requests.GitHub.GetActive.Request,
                    ): CancelablePromise<Requests.GitHub.GetActive.Response> => {
                        return new CancelablePromise((resolve) => {
                            resolve(
                                new Requests.GitHub.GetActive.Response({
                                    uuid: this.active === undefined ? undefined : this.active.uuid,
                                }),
                            );
                        });
                    },
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.GetRepos.Request,
                    (
                        _request: Requests.GitHub.GetRepos.Request,
                    ): CancelablePromise<Requests.GitHub.GetRepos.Response> => {
                        return new CancelablePromise((resolve) => {
                            resolve(
                                new Requests.GitHub.GetRepos.Response({
                                    repos: Array.from(this.repos.values()),
                                }),
                            );
                        });
                    },
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.GetFileMeta.Request,
                    (
                        request: Requests.GitHub.GetFileMeta.Request,
                    ): CancelablePromise<Requests.GitHub.GetFileMeta.Response> => {
                        return new CancelablePromise((resolve) => {
                            const metadata = this.files.get(request.checksum);
                            if (
                                request.sha !== undefined &&
                                metadata !== undefined &&
                                request.sha === metadata.file.sha
                            ) {
                                return resolve(
                                    new Requests.GitHub.GetFileMeta.Response({
                                        metadata: metadata.metadata.def,
                                        sha: metadata.file.sha,
                                        exists: true,
                                    }),
                                );
                            }
                            const job = jobs
                                .create({
                                    name: 'github: loading file data',
                                    icon: 'compare_arrows',
                                    spinner: true,
                                })
                                .start();
                            this.getFileMetaData(request.checksum)
                                .then((response: MetaDataLink | undefined) => {
                                    resolve(
                                        new Requests.GitHub.GetFileMeta.Response({
                                            metadata:
                                                response === undefined
                                                    ? undefined
                                                    : response.metadata.def,
                                            sha:
                                                response === undefined
                                                    ? undefined
                                                    : response.file.sha,
                                            exists: response !== undefined,
                                        }),
                                    );
                                })
                                .catch((err: Error | md.ProtocolError) => {
                                    resolve(
                                        new Requests.GitHub.GetFileMeta.Response({
                                            metadata: undefined,
                                            exists: false,
                                            error:
                                                err instanceof md.ProtocolError
                                                    ? `Protocol "${
                                                          err.declared
                                                      }" isn't supported; try to update chipmunk. Supported protocols: ${err.supported.join(
                                                          ', ',
                                                      )}`
                                                    : err.message,
                                        }),
                                    );
                                })
                                .finally(() => {
                                    job.done();
                                });
                        });
                    },
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.SetFileMeta.Request,
                    (
                        request: Requests.GitHub.SetFileMeta.Request,
                    ): CancelablePromise<Requests.GitHub.SetFileMeta.Response> => {
                        return new CancelablePromise((resolve) => {
                            const job = jobs
                                .create({
                                    name: 'github: writing file data',
                                    icon: 'compare_arrows',
                                    spinner: true,
                                })
                                .start();
                            this.setFileMetaData(
                                request.checksum,
                                new md.FileMetaData(request.metadata),
                            )
                                .then(() => {
                                    resolve(new Requests.GitHub.SetFileMeta.Response({}));
                                })
                                .catch((err: Error) => {
                                    resolve(
                                        new Requests.GitHub.SetFileMeta.Response({
                                            error: err.message,
                                        }),
                                    );
                                })
                                .finally(() => {
                                    job.done();
                                });
                        });
                    },
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.GetUserName.Request,
                    (
                        _request: Requests.GitHub.GetUserName.Request,
                    ): CancelablePromise<Requests.GitHub.GetUserName.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            if (this.active === undefined) {
                                return resolve(
                                    new Requests.GitHub.GetUserName.Response({
                                        error: `No active profile selected`,
                                    }),
                                );
                            }
                            const active = Object.assign({}, this.active);
                            this.getUserName(active)
                                .then((username: string) => {
                                    resolve(
                                        new Requests.GitHub.GetUserName.Response({
                                            username,
                                        }),
                                    );
                                })
                                .catch((err: Error) => {
                                    resolve(
                                        new Requests.GitHub.GetUserName.Response({
                                            error: err.message,
                                        }),
                                    );
                                });
                        });
                    },
                ),
        );
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        return Promise.resolve();
    }
}
export interface Service extends Interface {}
export const github = register(new Service());
