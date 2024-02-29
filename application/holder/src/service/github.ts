import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { electron } from '@service/electron';
import { storage } from '@service/storage';
import { CancelablePromise } from 'platform/env/promise';
import { unique } from 'platform/env/sequence';
import { GitHubRepo, validateGitHubRepo } from 'platform/types/github';
import { FileObject } from './github/getfilecontent';
import { error } from 'platform/log/utils';

import * as GitHubAPI from './github/index';
import * as Events from 'platform/ipc/event';
import * as Requests from 'platform/ipc/request';
import * as md from 'platform/types/github/filemetadata';
import * as validator from 'platform/env/obj';

const STORAGE_KEY = 'github_teamwork';
const STORAGE_REPOS = 'repos';
const STORAGE_ACTIVE = 'active_repo';

@DependOn(electron)
@DependOn(storage)
@SetupService(services['github'])
export class Service extends Implementation {
    protected readonly repos: Map<string, GitHubRepo> = new Map();
    protected active: GitHubRepo | undefined;

    protected async getFileMetaData(
        filename: string,
    ): Promise<md.FileMetaDataDefinition | undefined> {
        if (this.active === undefined) {
            throw new Error('No active repo selected');
        }
        const rest = new GitHubAPI.GetFileContent.Request(this.active, filename);
        const file: FileObject | undefined = await rest.send();
        if (file === undefined) {
            return undefined;
        }
        const metadata = md.fromJson(file.content);
        if (metadata instanceof md.ProtocolError || metadata instanceof Error) {
            throw metadata;
        }
        return metadata;
    }
    protected async setFileMetaData(
        filename: string,
        metadata: md.FileMetaDataDefinition,
    ): Promise<void> {
        if (this.active === undefined) {
            throw new Error('No active repo selected');
        }
        const branchSha = await new GitHubAPI.GetBrachSHA.Request(this.active).send();
        const baseTreeSha = (await new GitHubAPI.GetCommit.Request(this.active, branchSha).send())
            .tree.sha;
        const newTreeSha = await new GitHubAPI.CreateTree.Request(this.active, baseTreeSha, {
            path: filename,
            type: 'blob',
            mode: '100644',
            content: JSON.stringify(metadata),
        }).send();
        const newCommitSha = await new GitHubAPI.CreateCommit.Request(this.active, {
            message: new Date().toUTCString(),
            tree: newTreeSha,
            parents: [branchSha],
        }).send();
        await new GitHubAPI.UpdateRef.Request(this.active, {
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
                                parsed.forEach((repo: any) => {
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
    public override ready(): Promise<void> {
        this.storage().load();
        this.register(
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
                                });
                                this.storage().save();
                                resolve(new Requests.GitHub.AddRepo.Response({ uuid }));
                            }
                        });
                    },
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.RemoveRepo.Request,
                    (
                        request: Requests.GitHub.RemoveRepo.Request,
                    ): CancelablePromise<Requests.GitHub.RemoveRepo.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            if (!this.repos.has(request.uuid)) {
                                resolve(
                                    new Requests.GitHub.RemoveRepo.Response({
                                        error: 'Does not exist',
                                    }),
                                );
                            } else {
                                this.repos.delete(request.uuid);
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
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.UpdateRepo.Request,
                    (
                        request: Requests.GitHub.UpdateRepo.Request,
                    ): CancelablePromise<Requests.GitHub.UpdateRepo.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            if (!this.repos.has(request.uuid)) {
                                resolve(
                                    new Requests.GitHub.UpdateRepo.Response({
                                        error: 'Does not exist',
                                    }),
                                );
                            } else {
                                this.repos.set(request.uuid, {
                                    uuid: request.uuid,
                                    repo: request.repo,
                                    owner: request.owner,
                                    token: request.token,
                                    branch: request.branch,
                                });
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
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.SetActive.Request,
                    (
                        request: Requests.GitHub.SetActive.Request,
                    ): CancelablePromise<Requests.GitHub.SetActive.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            const repo = this.repos.get(request.uuid);
                            if (request.uuid === undefined) {
                                this.active = undefined;
                                this.storage().save();
                            } else if (repo !== undefined) {
                                this.active = repo;
                                this.storage().save();
                            } else {
                                resolve(
                                    new Requests.GitHub.SetActive.Response({
                                        error: 'Does not exist',
                                    }),
                                );
                                return;
                            }
                            resolve(
                                new Requests.GitHub.SetActive.Response({
                                    error: undefined,
                                }),
                            );
                        });
                    },
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.GetActive.Request,
                    (
                        _request: Requests.GitHub.GetActive.Request,
                    ): CancelablePromise<Requests.GitHub.GetActive.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            resolve(
                                new Requests.GitHub.GetActive.Response({
                                    uuid: this.active === undefined ? undefined : this.active.uuid,
                                }),
                            );
                        });
                    },
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.GetRepos.Request,
                    (
                        _request: Requests.GitHub.GetRepos.Request,
                    ): CancelablePromise<Requests.GitHub.GetRepos.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            resolve(
                                new Requests.GitHub.GetRepos.Response({
                                    repos: Array.from(this.repos.values()),
                                }),
                            );
                        });
                    },
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.GetFileMeta.Request,
                    (
                        request: Requests.GitHub.GetFileMeta.Request,
                    ): CancelablePromise<Requests.GitHub.GetFileMeta.Response> => {
                        return new CancelablePromise((resolve, reject) => {
                            this.getFileMetaData(request.checksum)
                                .then((metadata: md.FileMetaDataDefinition | undefined) => {
                                    resolve(
                                        new Requests.GitHub.GetFileMeta.Response({
                                            metadata,
                                            exists: metadata !== undefined,
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
                                });
                        });
                    },
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.GitHub.SetFileMeta.Request,
                    (
                        request: Requests.GitHub.SetFileMeta.Request,
                    ): CancelablePromise<Requests.GitHub.SetFileMeta.Response> => {
                        return new CancelablePromise((resolve, reject) => {
                            this.setFileMetaData(request.checksum, request.metadata)
                                .then(() => {
                                    resolve(new Requests.GitHub.SetFileMeta.Response({}));
                                })
                                .catch((err: Error) => {
                                    resolve(
                                        new Requests.GitHub.SetFileMeta.Response({
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
