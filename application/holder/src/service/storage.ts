import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { paths } from '@service/paths';
import { electron } from '@service/electron';
import { FileController } from '@env/fs/accessor';
import { CancelablePromise } from 'platform/env/promise';
import { Entries } from './storage/entries';
import { error } from 'platform/log/utils';
import { Entry } from 'platform/types/storage/entry';

import * as path from 'path';
import * as Requests from 'platform/ipc/request';

@DependOn(paths)
@DependOn(electron)
@SetupService(services['storage'])
export class Service extends Implementation {
    private _files: Map<string, FileController> = new Map();
    public readonly entries: Entries;

    constructor() {
        super();
        this.entries = new Entries(this._write.bind(this), this._read.bind(this));
    }

    public override ready(): Promise<void> {
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Storage.Read.Request,
                    (
                        request: Requests.Storage.Read.Request,
                    ): CancelablePromise<Requests.Storage.Read.Response> => {
                        return new CancelablePromise((resolve, reject) => {
                            this._read(request.key)
                                .then((content: string) => {
                                    resolve(
                                        new Requests.Storage.Read.Response({
                                            key: request.key,
                                            content,
                                        }),
                                    );
                                })
                                .catch(reject);
                        });
                    },
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Storage.Write.Request,
                    (
                        request: Requests.Storage.Write.Request,
                    ): CancelablePromise<Requests.Storage.Write.Response> => {
                        return new CancelablePromise((resolve, reject) => {
                            const error = this._write(request.key, request.content);
                            if (error instanceof Error) {
                                reject(error);
                            } else {
                                resolve(new Requests.Storage.Write.Response());
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
                    Requests.Storage.Delete.Request,
                    (
                        request: Requests.Storage.Delete.Request,
                    ): CancelablePromise<Requests.Storage.Delete.Response> => {
                        return new CancelablePromise((resolve, reject) => {
                            this._delete(request.key)
                                .then(() => {
                                    resolve(new Requests.Storage.Delete.Response());
                                })
                                .catch(reject);
                        });
                    },
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Storage.EntriesGet.Request,
                    (
                        request: Requests.Storage.EntriesGet.Request,
                    ): CancelablePromise<Requests.Storage.EntriesGet.Response> => {
                        return new CancelablePromise((resolve, reject) => {
                            if (request.key !== undefined) {
                                const key = request.key;
                                this.entries
                                    .get(request.key)
                                    .then((entries) => {
                                        resolve(
                                            new Requests.Storage.EntriesGet.Response({
                                                key,
                                                entries: JSON.stringify(
                                                    Array.from(entries.values()),
                                                ),
                                            }),
                                        );
                                    })
                                    .catch(reject);
                            } else if (request.file !== undefined) {
                                const filename = request.file;
                                const file = new FileController(request.file).init();
                                file.read()
                                    .then((content) => {
                                        const entries = Entries.from(content, filename, this.log());
                                        resolve(
                                            new Requests.Storage.EntriesGet.Response({
                                                key: filename,
                                                entries: JSON.stringify(
                                                    Array.from(entries.values()),
                                                ),
                                            }),
                                        );
                                    })
                                    .catch(reject);
                            } else {
                                reject(
                                    new Error(
                                        `Fail to read storage as soon as no "key" or "file" are defiend`,
                                    ),
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
                    Requests.Storage.EntriesSet.Request,
                    (
                        request: Requests.Storage.EntriesSet.Request,
                    ): CancelablePromise<Requests.Storage.EntriesSet.Response> => {
                        return new CancelablePromise((resolve, reject) => {
                            const entries: Entry[] | Error = (() => {
                                try {
                                    const entries: Entry[] = JSON.parse(request.entries);
                                    if (!(entries instanceof Array)) {
                                        throw new Error(`Expecting entries will be {Entry[]}`);
                                    }
                                    return entries;
                                } catch (e) {
                                    return new Error(this.log().error(error(e)));
                                }
                            })();
                            ((): Promise<void> => {
                                if (entries instanceof Error) {
                                    return Promise.reject(entries);
                                }
                                if (request.key !== undefined) {
                                    switch (request.mode) {
                                        case 'overwrite':
                                            return this.entries.overwrite(request.key, entries);
                                        case 'append':
                                            return this.entries.append(request.key, entries);
                                        case 'update':
                                            return this.entries.update(request.key, entries);
                                    }
                                } else if (request.file !== undefined) {
                                    const file = new FileController(request.file).init();
                                    const error = file.write(JSON.stringify(entries));
                                    if (error instanceof Error) {
                                        return Promise.reject(error);
                                    }
                                    return Promise.resolve();
                                }
                                return Promise.reject(
                                    new Error(
                                        `Fail to write storage as soon as no "key" or "file" are defiend`,
                                    ),
                                );
                            })()
                                .then(() => {
                                    resolve(new Requests.Storage.EntriesSet.Response());
                                })
                                .catch(reject);
                        });
                    },
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Storage.EntriesDelete.Request,
                    (
                        request: Requests.Storage.EntriesDelete.Request,
                    ): CancelablePromise<Requests.Storage.EntriesDelete.Response> => {
                        return new CancelablePromise((resolve, reject) => {
                            this.entries
                                .delete(request.key, request.uuids)
                                .then(() => {
                                    resolve(new Requests.Storage.EntriesDelete.Response());
                                })
                                .catch(reject);
                        });
                    },
                ),
        );
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        return Promise.all(Array.from(this._files.values()).map((f) => f.destroy()))
            .then(() => undefined)
            .catch((err: Error) => {
                this.log().error(`Fail to properly destroy storage: ${err.message}`);
            });
    }

    private _read(key: string): Promise<string> {
        if (!this._files.has(key)) {
            this._files.set(
                key,
                new FileController(path.join(paths.getStorage(), `${key}.storage`)).init(),
            );
        }
        const accessor = this._files.get(key);
        if (accessor === undefined) {
            return Promise.reject(new Error(`Fail to find accessor for "${key}"`));
        }
        return accessor.read();
    }

    private _write(key: string, content: string): Error | undefined {
        key = key.replace(/[^\d\w\s]/gi, '');
        if (key.length > 50 || key.length < 3) {
            return new Error(`Invalid file key`);
        }
        if (!this._files.has(key)) {
            this._files.set(
                key,
                new FileController(path.join(paths.getStorage(), `${key}.storage`)),
            );
        }
        const accessor = this._files.get(key);
        if (accessor === undefined) {
            return new Error(`Fail to find accessor for "${key}"`);
        }
        return accessor.write(content);
    }

    private _delete(key: string): Promise<void> {
        const accessor = this._files.get(key);
        if (accessor === undefined) {
            return Promise.reject(new Error(`Fail to find accessor for "${key}"`));
        }
        return new Promise((resolve, reject) => {
            accessor
                .delete()
                .then(() => {
                    this._files.delete(key);
                    resolve();
                })
                .catch(reject);
        });
    }
}
export interface Service extends Interface {}
export const storage = register(new Service());
