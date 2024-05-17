import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { File, Entity } from '@platform/types/files';
import { FileType } from '@platform/types/observe/types/file';
import { ShellProfile } from '@platform/types/shells';
import { StatisticInfo } from '@platform/types/observe/parser/dlt';
import { Entry } from '@platform/types/storage/entry';
import { error } from '@platform/log/utils';

import * as Requests from '@platform/ipc/request/index';

@SetupService(services['bridge'])
export class Service extends Implementation {
    protected cache: {
        shells: ShellProfile[] | undefined;
        files: Map<string, File>;
        checksums: Map<string, string>;
    } = {
        shells: undefined,
        files: new Map<string, File>(),
        checksums: new Map<string, string>(),
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
        getByPathWithCache(filenames: string[]): Promise<File[]>;
        ls(options: {
            paths: string[];
            depth: number;
            max: number;
            include?: { files: boolean; folders: boolean };
        }): Promise<{ entities: Entity[]; max: boolean }>;
        stat(path: string): Promise<Entity>;
        checksum(filename: string): Promise<string>;
        isBinary(file: string): Promise<boolean>;
        checksumWithCache(filename: string): Promise<string>;
        exists(path: string): Promise<boolean>;
        name(
            path: string,
        ): Promise<{ name: string; filename: string; parent: string; ext: string }>;
        cp(src: string, dest: string): Promise<void>;
        copy(files: string[], dest: string): Promise<void>;
        read(filename: string): Promise<string>;
        select: {
            any(): Promise<File[]>;
            dlt(): Promise<File[]>;
            pcapng(): Promise<File[]>;
            pcap(): Promise<File[]>;
            text(): Promise<File[]>;
            custom(ext: string): Promise<File[]>;
            save(ext?: string): Promise<string | undefined>;
        };
    } {
        const request = (target: FileType | undefined, ext?: string): Promise<File[]> => {
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
            getByPathWithCache: (filenames: string[]): Promise<File[]> => {
                return new Promise((resolve, reject) => {
                    const result: File[] = [];
                    const toBeRequested: string[] = [];
                    filenames.forEach((filename) => {
                        const file = this.cache.files.get(filename);
                        if (file === undefined) {
                            toBeRequested.push(filename);
                        } else {
                            result.push(file);
                        }
                    });

                    if (toBeRequested.length === 0) {
                        return resolve(result);
                    }
                    this.files()
                        .getByPath(toBeRequested)
                        .then((files) => {
                            result.push(...files);
                            files.forEach((file) => {
                                this.cache.files.set(file.filename, file);
                            });
                            resolve(result);
                        })
                        .catch(reject);
                });
            },
            ls(options: {
                paths: string[];
                depth: number;
                max: number;
                include?: { files: boolean; folders: boolean };
            }): Promise<{ entities: Entity[]; max: boolean }> {
                return Requests.IpcRequest.send(
                    Requests.Os.List.Response,
                    new Requests.Os.List.Request(
                        Object.assign(
                            {
                                include:
                                    options.include !== undefined
                                        ? options.include
                                        : { files: true, folders: true },
                            },
                            options,
                        ),
                    ),
                );
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
            isBinary: (file: string): Promise<boolean> => {
                return Requests.IpcRequest.send(
                    Requests.File.IsBinary.Response,
                    new Requests.File.IsBinary.Request({
                        file,
                    }),
                ).then((response) => {
                    if (response.error !== undefined) {
                        return Promise.reject(new Error(response.error));
                    } else {
                        return Promise.resolve(response.binary);
                    }
                });
            },
            checksumWithCache: (filename: string): Promise<string> => {
                const checksum = this.cache.checksums.get(filename);
                if (checksum !== undefined) {
                    return Promise.resolve(checksum);
                }
                return this.files()
                    .checksum(filename)
                    .then((checksum) => {
                        this.cache.checksums.set(filename, checksum);
                        return Promise.resolve(checksum);
                    });
            },
            cp: (src: string, dest: string): Promise<void> => {
                return Requests.IpcRequest.send(
                    Requests.File.CopyFile.Response,
                    new Requests.File.CopyFile.Request({
                        src,
                        dest,
                    }),
                ).then((response) => {
                    if (response.error !== undefined) {
                        return Promise.reject(new Error(response.error));
                    }
                    return Promise.resolve();
                });
            },
            copy: (files: string[], dest: string): Promise<void> => {
                return Requests.IpcRequest.send(
                    Requests.File.Copy.Response,
                    new Requests.File.Copy.Request({
                        files,
                        dest,
                    }),
                ).then((response) => {
                    if (response.error !== undefined) {
                        return Promise.reject(new Error(response.error));
                    }
                    return Promise.resolve();
                });
            },
            read: (filename: string): Promise<string> => {
                return Requests.IpcRequest.send(
                    Requests.File.Read.Response,
                    new Requests.File.Read.Request({
                        file: filename,
                    }),
                ).then((response) => {
                    if (response.error !== undefined) {
                        return Promise.reject(new Error(response.error));
                    }
                    return Promise.resolve(response.text as string);
                });
            },
            select: {
                any: (): Promise<File[]> => {
                    return request(undefined, `dlt,pcapng,txt,log,logs`);
                },
                dlt: (): Promise<File[]> => {
                    return request(FileType.Binary, 'dlt');
                },
                pcap: (): Promise<File[]> => {
                    return request(FileType.PcapLegacy, `pcap`);
                },
                pcapng: (): Promise<File[]> => {
                    return request(FileType.PcapNG, `pcapng`);
                },
                text: (): Promise<File[]> => {
                    return request(FileType.Text, `txt,log,logs`);
                },
                custom: (ext: string): Promise<File[]> => {
                    return request(undefined, ext);
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
        pcapng(): Promise<File[]>;
        pcap(): Promise<File[]>;
        text(): Promise<File[]>;
        custom(ext: string): Promise<File[]>;
        select(): Promise<string[]>;
        ls(paths: string[]): Promise<string[]>;
        delimiter(): Promise<string>;
    } {
        const request = (target: FileType | undefined, ext?: string): Promise<File[]> => {
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
                return request(undefined, `dlt,pcapng,txt,log,logs`);
            },
            dlt: (): Promise<File[]> => {
                return request(FileType.Binary, 'dlt');
            },
            pcapng: (): Promise<File[]> => {
                return request(FileType.PcapNG, `pcapng`);
            },
            pcap: (): Promise<File[]> => {
                return request(FileType.PcapLegacy, `pcap`);
            },
            text: (): Promise<File[]> => {
                return request(FileType.Text, `txt,log,logs`);
            },
            custom: (ext: string): Promise<File[]> => {
                return request(undefined, ext);
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
            ls: (paths: string[]): Promise<string[]> => {
                return this.files()
                    .ls({ paths, depth: 1, max: 500, include: { files: false, folders: true } })
                    .then((response) => {
                        return response.entities.map((e) => e.fullname);
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
        changelogs(version?: string): Promise<{ markdown: string; version: string }>;
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
            changelogs: (version?: string): Promise<{ markdown: string; version: string }> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.App.Changelogs.Response,
                        new Requests.App.Changelogs.Request({ version }),
                    )
                        .then((response) => {
                            if (response.error !== undefined) {
                                return reject(new Error(response.error));
                            }
                            resolve({ markdown: response.markdown, version: response.version });
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
                        entries: JSON.stringify(entries),
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
                            try {
                                const entries: Entry[] = JSON.parse(response.entries);
                                if (!(entries instanceof Array)) {
                                    throw new Error(`Expecting entries will be {Entry[]}`);
                                }
                                resolve(entries);
                            } catch (e) {
                                reject(new Error(this.log().error(error(e))));
                            }
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
