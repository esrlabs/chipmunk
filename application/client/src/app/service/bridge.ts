import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { File, FileType, Entity } from '@platform/types/files';
import { ShellProfile } from '@platform/types/shells';
import { StatisticInfo } from '@platform/types/parsers/dlt';
import { Entry } from '@platform/types/storage/entry';

import * as Requests from '@platform/ipc/request/index';

@SetupService(services['bridge'])
export class Service extends Implementation {
    protected cache: {
        shells: ShellProfile[] | undefined;
    } = {
        shells: undefined,
    };
    protected queue: {
        shells: Array<{
            resolve: (profiles: ShellProfile[]) => void;
            reject: (err: Error) => void;
        }>;
    } = {
        shells: [],
    };

    public override ready(): Promise<void> {
        this.os()
            .shells()
            .then(() => {
                this.log().debug(`List of shell's profiles is cached`);
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get list of shell's profiles: ${err.message}`);
            });
        return Promise.resolve();
    }
    public files(): {
        getByPath(filenames: string[]): Promise<File[]>;
        ls(path: string): Promise<Entity[]>;
        stat(path: string): Promise<Entity>;
        checksum(filename: string): Promise<string>;
        exists(path: string): Promise<boolean>;
        name(
            path: string,
        ): Promise<{ name: string; filename: string; parent: string; ext: string }>;
        select: {
            any(): Promise<File[]>;
            dlt(): Promise<File[]>;
            pcap(): Promise<File[]>;
            text(): Promise<File[]>;
            custom(ext: string): Promise<File[]>;
            save(ext?: string): Promise<string | undefined>;
        };
    } {
        const request = (target: FileType, ext?: string): Promise<File[]> => {
            return new Promise((resolve, reject) => {
                Requests.IpcRequest.send(
                    Requests.File.Select.Response,
                    new Requests.File.Select.Request({
                        target,
                        ext,
                    }),
                )
                    .then((response) => {
                        resolve(response.files);
                    })
                    .catch(reject);
            });
        };
        return {
            getByPath: (filenames: string[]): Promise<File[]> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.File.File.Response,
                        new Requests.File.File.Request({
                            filename: filenames,
                        }),
                    )
                        .then((response) => {
                            resolve(response.files);
                        })
                        .catch(reject);
                });
            },
            ls(path: string): Promise<Entity[]> {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Os.List.Response,
                        new Requests.Os.List.Request({
                            path,
                        }),
                    )
                        .then((response) => {
                            resolve(response.entities);
                        })
                        .catch(reject);
                });
            },
            stat(path: string): Promise<Entity> {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Os.AsFSEntity.Response,
                        new Requests.Os.AsFSEntity.Request({
                            path,
                        }),
                    )
                        .then((response) => {
                            if (response.entity !== undefined) {
                                resolve(response.entity);
                            } else if (response.error !== undefined) {
                                reject(new Error(response.error));
                            } else {
                                reject(new Error(`Unknown error`));
                            }
                        })
                        .catch(reject);
                });
            },
            exists: (path: string): Promise<boolean> => {
                return Requests.IpcRequest.send(
                    Requests.File.Exists.Response,
                    new Requests.File.Exists.Request({
                        path,
                    }),
                ).then((response) => {
                    return response.exists;
                });
            },
            name: (
                path: string,
            ): Promise<{ name: string; filename: string; parent: string; ext: string }> => {
                return Requests.IpcRequest.send(
                    Requests.File.Name.Response,
                    new Requests.File.Name.Request({
                        path,
                    }),
                ).then((response) => {
                    return {
                        name: response.name,
                        parent: response.parent,
                        ext: response.ext,
                        filename: response.filename,
                    };
                });
            },
            checksum: (filename: string): Promise<string> => {
                return Requests.IpcRequest.send(
                    Requests.File.Checksum.Response,
                    new Requests.File.Checksum.Request({
                        filename,
                    }),
                ).then((response) => {
                    if (response.hash !== undefined) {
                        return response.hash;
                    } else if (response.error !== undefined) {
                        return Promise.reject(new Error(response.error));
                    } else {
                        return Promise.reject(new Error(`Unknown error`));
                    }
                });
            },
            select: {
                any: (): Promise<File[]> => {
                    return request(FileType.Any, `dlt,pcap,txt,log,logs`);
                },
                dlt: (): Promise<File[]> => {
                    return request(FileType.Dlt);
                },
                pcap: (): Promise<File[]> => {
                    return request(FileType.Pcap);
                },
                text: (): Promise<File[]> => {
                    return request(FileType.Text);
                },
                custom: (ext: string): Promise<File[]> => {
                    return request(FileType.Any, ext);
                },
                save: (ext?: string): Promise<string | undefined> => {
                    return Requests.IpcRequest.send(
                        Requests.File.Save.Response,
                        new Requests.File.Save.Request({
                            ext,
                        }),
                    ).then((response) => {
                        if (response.error !== undefined) {
                            return Promise.reject(new Error(response.error));
                        }
                        return response.filename;
                    });
                },
            },
        };
    }

    public folders(): {
        any(): Promise<File[]>;
        dlt(): Promise<File[]>;
        pcap(): Promise<File[]>;
        text(): Promise<File[]>;
        custom(ext: string): Promise<File[]>;
        select(): Promise<string[]>;
        ls(path: string): Promise<string[]>;
        delimiter(): Promise<string>;
    } {
        const request = (target: FileType, ext?: string): Promise<File[]> => {
            return new Promise((resolve, reject) => {
                Requests.IpcRequest.send(
                    Requests.Folder.Select.Response,
                    new Requests.Folder.Select.Request({
                        target,
                        ext,
                    }),
                )
                    .then((response) => {
                        resolve(response.files);
                    })
                    .catch(reject);
            });
        };
        return {
            any: (): Promise<File[]> => {
                return request(FileType.Any);
            },
            dlt: (): Promise<File[]> => {
                return request(FileType.Dlt);
            },
            pcap: (): Promise<File[]> => {
                return request(FileType.Pcap);
            },
            text: (): Promise<File[]> => {
                return request(FileType.Any);
            },
            custom: (ext: string): Promise<File[]> => {
                return request(FileType.Any, ext);
            },
            select: (): Promise<string[]> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Folder.Choose.Response,
                        new Requests.Folder.Choose.Request(),
                    )
                        .then((response) => {
                            resolve(response.paths);
                        })
                        .catch(reject);
                });
            },
            ls: (path: string): Promise<string[]> => {
                return Requests.IpcRequest.send(
                    Requests.Folder.Ls.Response,
                    new Requests.Folder.Ls.Request({ path }),
                ).then((response) => {
                    return response.folders;
                });
            },
            delimiter: (): Promise<string> => {
                return Requests.IpcRequest.send(
                    Requests.Folder.Delimiter.Response,
                    new Requests.Folder.Delimiter.Request(),
                ).then((response) => {
                    return response.delimiter;
                });
            },
        };
    }

    public dlt(): {
        stat(files: string[]): Promise<StatisticInfo>;
    } {
        return {
            stat: (files: string[]): Promise<StatisticInfo> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Dlt.Stat.Response,
                        new Requests.Dlt.Stat.Request({
                            files,
                        }),
                    )
                        .then((response) => {
                            resolve(response.stat);
                        })
                        .catch(reject);
                });
            },
        };
    }

    public storage(key: string): {
        write(content: string): Promise<void>;
        read(): Promise<string>;
    } {
        return {
            write: (content: string): Promise<void> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Storage.Write.Response,
                        new Requests.Storage.Write.Request({
                            key,
                            content,
                        }),
                    )
                        .then(() => {
                            resolve(undefined);
                        })
                        .catch(reject);
                });
            },
            read: (): Promise<string> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Storage.Read.Response,
                        new Requests.Storage.Read.Request({
                            key,
                        }),
                    )
                        .then((response) => {
                            resolve(response.content);
                        })
                        .catch(reject);
                });
            },
        };
    }

    public ports(): {
        list(): Promise<string[]>;
    } {
        return {
            list: (): Promise<string[]> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Serial.Ports.Response,
                        new Requests.Serial.Ports.Request(),
                    )
                        .then((response) => {
                            resolve(response.ports);
                        })
                        .catch(reject);
                });
            },
        };
    }

    public brower(): {
        url(url: string): Promise<void>;
    } {
        return {
            url: (url: string): Promise<void> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Actions.UrlInBrowser.Response,
                        new Requests.Actions.UrlInBrowser.Request({ url }),
                    )
                        .then((_response) => {
                            resolve();
                        })
                        .catch(reject);
                });
            },
        };
    }

    public cwd(): {
        set(uuid: string | undefined, path: string): Promise<void>;
        get(uuid: string | undefined): Promise<string>;
    } {
        return {
            set: (uuid: string | undefined, path: string): Promise<void> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Cwd.Set.Response,
                        new Requests.Cwd.Set.Request({
                            uuid,
                            cwd: path,
                        }),
                    )
                        .then((response) => {
                            if (response.error !== undefined) {
                                return reject(new Error(response.error));
                            }
                            resolve(undefined);
                        })
                        .catch(reject);
                });
            },
            get: (uuid: string | undefined): Promise<string> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Cwd.Get.Response,
                        new Requests.Cwd.Get.Request({
                            uuid,
                        }),
                    )
                        .then((response) => {
                            resolve(response.cwd);
                        })
                        .catch(reject);
                });
            },
        };
    }

    public os(): {
        homedir(): Promise<string>;
        shells(): Promise<ShellProfile[]>;
        envvars(): Promise<Map<string, string>>;
    } {
        return {
            homedir: (): Promise<string> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Os.HomeDir.Response,
                        new Requests.Os.HomeDir.Request(),
                    )
                        .then((response) => {
                            resolve(response.path);
                        })
                        .catch(reject);
                });
            },
            shells: (): Promise<ShellProfile[]> => {
                return new Promise((resolve, reject) => {
                    if (this.cache.shells !== undefined) {
                        resolve(this.cache.shells);
                    } else {
                        this.queue.shells.push({ resolve, reject });
                        this.queue.shells.length === 1 &&
                            Requests.IpcRequest.send(
                                Requests.Os.Shells.Response,
                                new Requests.Os.Shells.Request(),
                            )
                                .then((response) => {
                                    this.cache.shells = response.profiles
                                        .map((p) => ShellProfile.fromObj(p))
                                        .filter((p) => p instanceof ShellProfile) as ShellProfile[];
                                    this.queue.shells
                                        .map((h) => h.resolve)
                                        .forEach((r) => r(this.cache.shells as ShellProfile[]));
                                })
                                .catch((err: Error) => {
                                    this.queue.shells.map((h) => h.reject).forEach((r) => r(err));
                                })
                                .finally(() => {
                                    this.queue.shells = [];
                                });
                    }
                });
            },
            envvars: (): Promise<Map<string, string>> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Os.EnvVars.Response,
                        new Requests.Os.EnvVars.Request(),
                    )
                        .then((response) => {
                            resolve(response.envvars);
                        })
                        .catch(reject);
                });
            },
        };
    }

    public env(): {
        inject(envs: { [key: string]: string }): Promise<void>;
        get(): Promise<{ [key: string]: string }>;
    } {
        return {
            inject: (env: { [key: string]: string }): Promise<void> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Env.Set.Response,
                        new Requests.Env.Set.Request({
                            env,
                        }),
                    )
                        .then((response) => {
                            if (response.error !== undefined) {
                                return reject(new Error(response.error));
                            }
                            resolve(undefined);
                        })
                        .catch(reject);
                });
            },
            get: (): Promise<{ [key: string]: string }> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Env.Get.Response,
                        new Requests.Env.Get.Request(),
                    )
                        .then((response) => {
                            resolve(response.env);
                        })
                        .catch(reject);
                });
            },
        };
    }

    public app(): {
        version(): Promise<string>;
    } {
        return {
            version: (): Promise<string> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.App.Version.Response,
                        new Requests.App.Version.Request(),
                    )
                        .then((response) => {
                            if (response.error !== undefined) {
                                return reject(new Error(response.error));
                            }
                            resolve(response.version);
                        })
                        .catch(reject);
                });
            },
        };
    }

    public entries(dest: { key?: string; file?: string }): {
        get(): Promise<Entry[]>;
        /**
         * Updates existed and inserts new entries
         * @param entries entries to be updated or inserted. If entry already exist, it will be updated with given
         * @returns
         */
        update(entries: Entry[]): Promise<void>;
        /**
         * Inserts new entries without updating existed
         * @param entries entries to be inserted. If entry already exist, it will be ignored
         * @returns
         */
        append(entries: Entry[]): Promise<void>;
        /**
         * Clean storage (remove all existed entries) and set with given entries
         * @param entries entries to be inserted.
         * @returns
         */
        overwrite(entries: Entry[]): Promise<void>;
        /**
         * Removes given entries
         * @param uuids list of uuids of entries to be removed
         * @returns
         */
        delete(uuids: string[]): Promise<void>;
    } {
        const set = (
            dest: { key?: string; file?: string },
            entries: Entry[],
            mode: 'overwrite' | 'update' | 'append',
        ): Promise<undefined> => {
            return new Promise((resolve, reject) => {
                Requests.IpcRequest.send(
                    Requests.Storage.EntriesSet.Response,
                    new Requests.Storage.EntriesSet.Request({
                        key: dest.key,
                        file: dest.file,
                        entries,
                        mode,
                    }),
                )
                    .then(() => {
                        resolve(undefined);
                    })
                    .catch(reject);
            });
        };
        return {
            get: (): Promise<Entry[]> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Storage.EntriesGet.Response,
                        new Requests.Storage.EntriesGet.Request({
                            key: dest.key,
                            file: dest.file,
                        }),
                    )
                        .then((response) => {
                            resolve(response.entries);
                        })
                        .catch(reject);
                });
            },
            update: (entries: Entry[]): Promise<void> => {
                return set(dest, entries, 'update');
            },
            overwrite: (entries: Entry[]): Promise<void> => {
                return set(dest, entries, 'overwrite');
            },
            append: (entries: Entry[]): Promise<void> => {
                return set(dest, entries, 'append');
            },
            delete: (uuids: string[]): Promise<void> => {
                if (dest.key === undefined) {
                    return Promise.reject(
                        new Error(`Delete functionality is available only for internal storages`),
                    );
                }
                const key = dest.key;
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Storage.EntriesDelete.Response,
                        new Requests.Storage.EntriesDelete.Request({
                            key,
                            uuids,
                        }),
                    )
                        .then(() => {
                            resolve(undefined);
                        })
                        .catch(reject);
                });
            },
        };
    }
}
export interface Service extends Interface {}
export const bridge = register(new Service());
