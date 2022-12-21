import { Instance as Logger } from '@platform/env/logger';
import { error } from '@platform/env/logger';
import { scope } from '@platform/env/scope';
import { bridge } from '@service/bridge';
import { Subjects, Subject } from '@platform/env/subscription';

import * as obj from '@platform/env/obj';

const ROOTS_STORAGE_KEY = 'user_favourites_places';
const STATE_STORAGE_KEY = 'user_favourites_state';

export class Favorites {
    public favourites: string[] = [];
    public updates: Subjects<{
        list: Subject<void>;
        state: Subject<void>;
    }> = new Subjects({
        list: new Subject(),
        state: new Subject(),
    });
    protected readonly log: Logger;

    constructor() {
        this.log = scope.getLogger(`FavoritesReader`);
    }

    public destroy(): void {
        this.updates.destroy();
    }

    public places(): {
        get(): Promise<string[]>;
        add(path: string): Promise<void>;
        remove(path: string): Promise<void>;
    } {
        return {
            get: (): Promise<string[]> => {
                return this.storage().get();
            },
            add: (path: string): Promise<void> => {
                if (path.trim().length === 0 || this.favourites.indexOf(path) !== -1) {
                    return Promise.resolve();
                }
                return this.storage()
                    .set(this.favourites)
                    .catch((err: Error) => {
                        this.log.error(`Fail to save favourites: ${err.message}`);
                    });
            },
            remove: (path: string): Promise<void> => {
                if (path.trim().length === 0 || this.favourites.indexOf(path) === -1) {
                    return Promise.resolve();
                }
                this.favourites = this.favourites.filter((f) => f !== path);
                return this.storage()
                    .set(this.favourites)
                    .catch((err: Error) => {
                        this.log.error(`Fail to save favourites: ${err.message}`);
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

    protected expanded(): {
        get(): Promise<{ path: string; parent: string }[]>;
        write(nodes: { path: string; parent: string }[]): Promise<void>;
        add(path: string, parent: string): Promise<void>;
        remove(path: string): Promise<void>;
    } {
        return {
            get: (): Promise<{ path: string; parent: string }[]> => {
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
                                this.log.error(`Fail to parse folder's tree state: ${error(e)}`);
                                resolve([]);
                            }
                        })
                        .catch(reject);
                });
            },
            write: (nodes: { path: string; parent: string }[]): Promise<void> => {
                return bridge
                    .entries({ key: STATE_STORAGE_KEY })
                    .overwrite(
                        nodes.map((node: { path: string; parent: string }) => {
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
                const expanded = await this.expanded().get();
                if (expanded.find((v) => v.path === path) !== undefined) {
                    return;
                }
                expanded.push({ path, parent });
                this.expanded()
                    .write(expanded)
                    .catch((err: Error) => {
                        this.log.error(`Fail to write update expanded list: ${err.message}`);
                    });
            },
            remove: async (path: string): Promise<void> => {
                let expanded = await this.expanded().get();
                if (expanded.find((value) => value.path === path) === undefined) {
                    return;
                }
                expanded = expanded.filter((v) => v.path !== path && v.parent !== path);
                this.expanded()
                    .write(expanded)
                    .catch((err: Error) => {
                        this.log.error(`Fail to write update expanded list: ${err.message}`);
                    });
            },
        };
    }
}
