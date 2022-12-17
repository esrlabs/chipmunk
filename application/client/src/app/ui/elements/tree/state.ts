import { Entity, EntityType } from '@platform/types/files';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Services } from '@service/ilc';
import { Instance as Logger } from '@platform/env/logger';
import { Filter } from '@elements/filter/filter';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { error } from '@platform/env/logger';

import * as Scheme from './scheme';
import * as obj from '@platform/env/obj';

const ROOTS_STORAGE_KEY = 'user_favourites_places';
const STATE_STORAGE_KEY = 'user_favourites_state';

export class State {
    public filter: Filter;
    public favourites: string[] = [];
    public scheme!: {
        db: Scheme.DynamicDatabase;
        tree: FlatTreeControl<Scheme.DynamicFlatNode>;
        source: Scheme.DynamicDataSource;
    };
    protected ilc: IlcInterface & ChangesDetector;
    private _services!: Services;
    private _log!: Logger;

    constructor(ilc: IlcInterface & ChangesDetector) {
        this.ilc = ilc;
        this.filter = new Filter(ilc, {
            clearOnEnter: true,
            clearOnEscape: true,
            placeholder: 'Files filter',
        });
        this.filter.subjects.get().change.subscribe((_path: string) => {
            ilc.detectChanges();
        });
        ilc.env().subscriber.register(
            ilc
                .ilc()
                .services.ui.listener.listen<KeyboardEvent>(
                    'keydown',
                    window,
                    (event: KeyboardEvent) => {
                        const count = this.scheme.source.data.length;
                        const selected = this.scheme.source.data.findIndex((d) => d.item.selected);
                        if (selected === -1) {
                            if (count > 0) {
                                this.scheme.source.data[0].item.selecting().select();
                            }
                            return true;
                        }
                        const selectedRef = this.scheme.source.data[selected];
                        const nextRef = this.scheme.source.data[selected + 1];
                        const prevRef = this.scheme.source.data[selected - 1];
                        if (event.key === 'ArrowDown' && nextRef !== undefined) {
                            selectedRef.item.selecting().unselect();
                            nextRef.item.selecting().select();
                        } else if (event.key === 'ArrowUp' && prevRef !== undefined) {
                            selectedRef.item.selecting().unselect();
                            prevRef.item.selecting().select();
                        } else if (event.key === ' ') {
                            if (selectedRef.expandable) {
                                this.scheme.source.toggleNode(selectedRef, true);
                            }
                        }
                        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                            ilc.detectChanges();
                            this._scrollIntoView();
                            return false;
                        }
                        ilc.detectChanges();
                        return true;
                    },
                ),
        );
    }

    public async init(services: Services, log: Logger): Promise<void> {
        this._services = services;
        this._log = log;
        const db = new Scheme.DynamicDatabase(this.favourites.slice(), services, this.filter);
        const tree = new FlatTreeControl<Scheme.DynamicFlatNode>(
            (node: Scheme.DynamicFlatNode) => node.level,
            (node: Scheme.DynamicFlatNode) => node.expandable,
        );
        const source = new Scheme.DynamicDataSource(
            tree,
            db,
            (entity: Scheme.Entity, expanded: boolean) => {
                (() => {
                    if (expanded) {
                        return this.expanded().add(entity);
                    } else {
                        return this.expanded().remove(entity);
                    }
                })().catch((err: Error) => {
                    this._log.error(`Fail to update state of folder's tree: ${err.message}`);
                });
            },
        );
        db.bind(source);
        source.data = db.initialData();
        this.scheme = { db, tree, source };
        const favourites = await this._storage().get();
        this.favourites = favourites.slice();
        this.scheme.db.overwrite(favourites.slice());
        const expanded = await this.expanded().get();
        this.scheme.source.expand(expanded.map((v) => v.path));
        if (this.scheme.source.data.length > 0) {
            this.scheme.source.data[0].item.selecting().select();
        }
    }

    public select(node: Scheme.DynamicFlatNode) {
        const selected = this.scheme.source.data.find((d) => d.item.selected);
        if (selected !== undefined) {
            selected.item.selecting().unselect();
        }
        node.item.selecting().select();
        this.ilc.detectChanges();
    }

    public addPlace(path: string) {
        if (path.trim().length === 0 || this.favourites.indexOf(path) !== -1) {
            return;
        }
        this._services.system.bridge
            .files()
            .stat(path)
            .then((entity: Entity) => {
                if (entity.type !== EntityType.Directory) {
                    return;
                }
                this.favourites.push(path);
                this.scheme.db.addRoot(path);
                this.scheme.source.data = this.scheme.db.initialData();
                this._storage()
                    .set(this.favourites)
                    .catch((err: Error) => {
                        this._log.error(`Fail to save favourites: ${err.message}`);
                    });
            })
            .catch((err: Error) => {
                this._log.error(err.message);
            });
    }

    public removePlace(entity: Scheme.Entity) {
        const path = entity.getPath();
        if (path.trim().length === 0 || this.favourites.indexOf(path) === -1) {
            return;
        }
        this.expanded()
            .remove(entity)
            .catch((err: Error) => {
                this._log.error(`Fail to update state of folder's tree: ${err.message}`);
            });
        this.favourites = this.favourites.filter((f) => f !== path);
        this.scheme.db.removeRoot(path);
        this.scheme.source.data = this.scheme.db.initialData();
        this._storage()
            .set(this.favourites)
            .catch((err: Error) => {
                this._log.error(`Fail to save favourites: ${err.message}`);
            });
    }

    private _storage(): {
        get(): Promise<string[]>;
        set(value: string[]): Promise<void>;
    } {
        return {
            get: (): Promise<string[]> => {
                return new Promise((resolve, reject) => {
                    this._services.system.bridge
                        .entries({ key: ROOTS_STORAGE_KEY })
                        .get()
                        .then((entries) => {
                            resolve(entries.map((entry) => entry.content));
                        })
                        .catch(reject);
                });
            },
            set: (value: string[]): Promise<void> => {
                return this._services.system.bridge.entries({ key: ROOTS_STORAGE_KEY }).overwrite(
                    value.map((path: string) => {
                        return {
                            uuid: path,
                            content: path,
                        };
                    }),
                );
            },
        };
    }

    protected expanded(): {
        get(): Promise<{ path: string; parent: string }[]>;
        write(nodes: { path: string; parent: string }[]): Promise<void>;
        add(entity: Scheme.Entity): Promise<void>;
        remove(entity: Scheme.Entity): Promise<void>;
    } {
        return {
            get: (): Promise<{ path: string; parent: string }[]> => {
                return new Promise((resolve, reject) => {
                    this._services.system.bridge
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
                                this._log.error(`Fail to parse folder's tree state: ${error(e)}`);
                                resolve([]);
                            }
                        })
                        .catch(reject);
                });
            },
            write: (nodes: { path: string; parent: string }[]): Promise<void> => {
                return this._services.system.bridge.entries({ key: STATE_STORAGE_KEY }).overwrite(
                    nodes.map((node: { path: string; parent: string }) => {
                        return {
                            uuid: node.path,
                            content: JSON.stringify(node),
                        };
                    }),
                );
            },
            add: async (entity: Scheme.Entity): Promise<void> => {
                const expanded = await this.expanded().get();
                const path = entity.getPath();
                if (expanded.find((v) => v.path === path) !== undefined) {
                    return;
                }
                expanded.push({ path, parent: entity.parent });
                this.expanded()
                    .write(expanded)
                    .catch((err: Error) => {
                        this._log.error(`Fail to write update expanded list: ${err.message}`);
                    });
            },
            remove: async (entity: Scheme.Entity): Promise<void> => {
                let expanded = await this.expanded().get();
                const path = entity.getPath();
                if (expanded.find((value) => value.path === path) === undefined) {
                    return;
                }
                expanded = expanded.filter((v) => v.path !== path && v.parent !== path);
                this.expanded()
                    .write(expanded)
                    .catch((err: Error) => {
                        this._log.error(`Fail to write update expanded list: ${err.message}`);
                    });
            },
        };
    }

    private _scrollIntoView() {
        const nodes = document.querySelectorAll(`mat-tree-node[data-selected="true"]`);
        if (nodes.length === 0) {
            return;
        }
        nodes.forEach((node: Element) => {
            (node as HTMLElement).scrollIntoView({
                behavior: 'auto',
                block: 'nearest',
                inline: 'nearest',
            });
        });
    }
}
