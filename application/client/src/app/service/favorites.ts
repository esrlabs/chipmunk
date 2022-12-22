import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from '@platform/entity/service';
import { services } from '@register/services';
import { error } from '@platform/env/logger';
import { bridge } from '@service/bridge';
import { Subjects, Subject } from '@platform/env/subscription';

import * as obj from '@platform/env/obj';
import { EntityType } from '@platform/types/files';

const ROOTS_STORAGE_KEY = 'user_favourites_places';
const STATE_STORAGE_KEY = 'user_favourites_state';

export interface FavoriteState {
    path: string;
    parent: string;
}

@DependOn(bridge)
@SetupService(services['favorites'])
export class Service extends Implementation {
    public favorites: string[] = [];
    public states: FavoriteState[] = [];
    public updates: Subjects<{
        list: Subject<void>;
        state: Subject<void>;
    }> = new Subjects({
        list: new Subject(),
        state: new Subject(),
    });

    public override async ready(): Promise<void> {
        await Promise.all([
            this.places()
                .get()
                .then((favorites) => {
                    this.favorites = favorites;
                })
                .catch((err: Error) => {
                    this.log().error(`Fail to load favorites: ${err.message}`);
                }),
            this.expanded()
                .get()
                .then((states) => {
                    this.states = states;
                })
                .catch((err: Error) => {
                    this.log().error(`Fail to load states: ${err.message}`);
                }),
        ]);
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.updates.destroy();
        return Promise.resolve();
    }

    public places(): {
        get(): Promise<string[]>;
        add(paths: string[] | string): Promise<void>;
        has(path: string): boolean;
        selectAndAdd(): Promise<void>;
        remove(path: string): Promise<void>;
    } {
        return {
            get: (): Promise<string[]> => {
                return this.storage().get();
            },
            add: async (paths: string[] | string): Promise<void> => {
                if (!(paths instanceof Array)) {
                    paths = [paths];
                }
                paths = paths.filter((p) => p.trim() !== '' && !this.places().has(p));
                if (paths.length === 0) {
                    return Promise.resolve();
                }
                const accepted: string[] = [];
                for (const path of paths) {
                    const stat = await bridge.files().stat(path);
                    if (stat.type === EntityType.Directory) {
                        accepted.push(path);
                    }
                }
                this.favorites = this.favorites.concat(accepted);
                return this.storage()
                    .set(this.favorites)
                    .then(() => {
                        this.updates.get().list.emit();
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to save favorites: ${err.message}`);
                    });
            },
            has: (path: string): boolean => {
                return this.favorites.indexOf(path) !== -1;
            },
            selectAndAdd: async (): Promise<void> => {
                const folders = await bridge.folders().select();
                return this.places().add(folders);
            },
            remove: (path: string): Promise<void> => {
                if (path.trim().length === 0 || !this.places().has(path)) {
                    return Promise.resolve();
                }
                this.favorites = this.favorites.filter((f) => f !== path);
                this.expanded()
                    .remove(path)
                    .then(() => {
                        this.updates.get().state.emit();
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to update state of favorites: ${err.message}`);
                    });
                return this.storage()
                    .set(this.favorites)
                    .then(() => {
                        this.updates.get().list.emit();
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to save favorites: ${err.message}`);
                    });
            },
        };
    }

    protected storage(): {
        get(): Promise<string[]>;
        set(value: string[]): Promise<void>;
    } {
        return {
            get: (): Promise<string[]> => {
                return new Promise((resolve, reject) => {
                    bridge
                        .entries({ key: ROOTS_STORAGE_KEY })
                        .get()
                        .then((entries) => {
                            resolve(entries.map((entry) => entry.content));
                        })
                        .catch(reject);
                });
            },
            set: (value: string[]): Promise<void> => {
                return bridge
                    .entries({ key: ROOTS_STORAGE_KEY })
                    .overwrite(
                        value.map((path: string) => {
                            return {
                                uuid: path,
                                content: path,
                            };
                        }),
                    )
                    .finally(() => {
                        this.updates.get().list.emit();
                    });
            },
        };
    }

    public expanded(): {
        get(): Promise<FavoriteState[]>;
        write(): Promise<void>;
        add(path: string, parent: string): Promise<void>;
        remove(path: string): Promise<void>;
    } {
        return {
            get: (): Promise<FavoriteState[]> => {
                return new Promise((resolve, reject) => {
                    bridge
                        .entries({ key: STATE_STORAGE_KEY })
                        .get()
                        .then((entries) => {
                            try {
                                const nodes = entries.map((entry) => {
                                    const node = JSON.parse(entry.content);
                                    return {
                                        path: obj.getAsString(node, 'path'),
                                        parent: obj.getAsString(node, 'parent'),
                                    };
                                });
                                resolve(nodes);
                            } catch (e) {
                                this.log().error(`Fail to parse folder's tree state: ${error(e)}`);
                                resolve([]);
                            }
                        })
                        .catch(reject);
                });
            },
            write: (): Promise<void> => {
                return bridge
                    .entries({ key: STATE_STORAGE_KEY })
                    .overwrite(
                        this.states.map((node: FavoriteState) => {
                            return {
                                uuid: node.path,
                                content: JSON.stringify(node),
                            };
                        }),
                    )
                    .finally(() => {
                        this.updates.get().state.emit();
                    });
            },
            add: async (path: string, parent: string): Promise<void> => {
                if (this.states.find((v) => v.path === path) !== undefined) {
                    return;
                }
                this.states.push({ path, parent });
                this.expanded()
                    .write()
                    .catch((err: Error) => {
                        this.log().error(`Fail to write update expanded list: ${err.message}`);
                    });
            },
            remove: async (path: string): Promise<void> => {
                if (this.states.find((value) => value.path === path) === undefined) {
                    return;
                }
                this.states = this.states.filter((v) => v.path !== path && v.parent !== path);
                this.expanded()
                    .write()
                    .catch((err: Error) => {
                        this.log().error(`Fail to write update expanded list: ${err.message}`);
                    });
            },
        };
    }
}
export interface Service extends Interface {}
export const favorites = register(new Service());
