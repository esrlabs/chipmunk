import {
    Provider,
    ProviderConstructor,
    ProviderData,
    ISelectEvent,
    IContextMenuEvent,
    EActions,
    IDoubleclickEvent,
} from './definitions/provider';
import { Subject, unsubscribeAllInHolder } from '@platform/env/subscription';
import { Session } from '@service/session/session';
import { KeyboardListener } from './definitions/keyboard.listener';
import { IMenuItem } from '@ui/service/contextmenu';
import { Entity } from './definitions/entity';
import { unique } from '@platform/env/sequence';
import { DragAndDropService } from '../draganddrop/service';
import { Logger } from '@platform/log';

type TSelectedEntities = string[];

// const PROVIDERS_SCOPE_KEY: string = 'SEARCH_MANAGER_PROVIDERS_SCOPE_KEY';

export class Providers {
    public readonly subjects: {
        select: Subject<ISelectEvent | undefined>;
        context: Subject<IContextMenuEvent>;
        doubleclick: Subject<IDoubleclickEvent>;
        change: Subject<void>;
        edit: Subject<string | undefined>;
    } = {
        select: new Subject(),
        context: new Subject(),
        doubleclick: new Subject(),
        change: new Subject(),
        edit: new Subject(),
    };
    public readonly session: Session;
    public readonly logger: Logger;
    public readonly draganddrop: DragAndDropService;

    private readonly SENDER = unique();
    private readonly PROVIDERS_ORDER: ProviderData[] = [
        ProviderData.filters,
        ProviderData.charts,
        ProviderData.ranges,
        ProviderData.disabled,
    ];

    private readonly _providers: Map<ProviderData, Provider<any>> = new Map();
    private readonly _keyboard: KeyboardListener = new KeyboardListener();

    constructor(session: Session, draganddrop: DragAndDropService, logger: Logger) {
        this.draganddrop = draganddrop;
        this.session = session;
        this.logger = logger;
    }

    public destroy() {
        unsubscribeAllInHolder(this.subjects);
        this._providers.forEach((provider: Provider<any>) => {
            provider.destroy();
        });
        this._keyboard.destroy();
        this._store().drop();
    }

    public add(name: ProviderData, providerConstructor: ProviderConstructor): boolean {
        if (this._providers.has(name)) {
            return false;
        }
        const provider = new providerConstructor(this.session, this.draganddrop, this.logger);
        provider.setKeyboardListener(this._keyboard);
        provider.setProvidersGetter(this.list.bind(this));
        provider.subjects.selection.subscribe(this._onSelectionEntity.bind(this));
        provider.subjects.context.subscribe(this._onContextMenuEvent.bind(this));
        provider.subjects.doubleclick.subscribe(this._onDoubleclickEvent.bind(this));
        provider.subjects.change.subscribe(this._onChange.bind(this));
        provider.subjects.reload.subscribe(this._onReload.bind(this));
        provider.subjects.edit.subscribe(this._onEdit.bind(this));
        provider.init();
        this._providers.set(name, provider);
        return true;
    }

    public all(): any[] {
        let entries: any[] = [];
        this.list().forEach((provider: Provider<any>) => {
            entries = entries.concat(provider.entities());
        });
        return entries;
    }

    public list(): Provider<any>[] {
        const list: Provider<any>[] = [];
        this.PROVIDERS_ORDER.forEach((ref: ProviderData) => {
            const provider: Provider<any> | undefined = this._providers.get(ref);
            if (provider !== undefined) {
                list.push(provider);
            }
        });
        return list;
    }

    public select(): {
        next(): void;
        prev(): void;
        drop(): void;
        first(): void;
        last(): void;
        single():
            | { provider: Provider<any>; next?: Provider<any>; prev?: Provider<any>; guid: string }
            | undefined;
        getEntities(): Array<Entity<any>>;
        getProviders(): Array<Provider<any>>;
    } {
        return {
            next: (): void => {
                if (this._providers.size === 0) {
                    return;
                }
                const sel = this.select().single();
                if (sel === undefined) {
                    this.select().drop();
                    this.select().first();
                } else {
                    if (!sel.provider.select().next()) {
                        sel.provider.select().drop();
                        if (sel.next !== undefined) {
                            sel.next.select().first();
                        } else {
                            this.select().first();
                        }
                    }
                }
            },
            prev: (): void => {
                if (this._providers.size === 0) {
                    return;
                }
                const sel = this.select().single();
                if (sel === undefined) {
                    this.select().drop();
                    this.select().last();
                } else {
                    if (!sel.provider.select().prev()) {
                        sel.provider.select().drop();
                        if (sel.prev !== undefined) {
                            sel.prev.select().last();
                        } else {
                            this.select().last();
                        }
                    }
                }
            },
            drop: (): void => {
                this._providers.forEach((provider: Provider<any>) => {
                    provider.select().drop(this.SENDER);
                });
            },
            first: (): void => {
                if (this._providers.size === 0) {
                    return;
                }
                (Array.from(this._providers.values())[0] as Provider<any>).select().first();
            },
            last: (): void => {
                if (this._providers.size === 0) {
                    return;
                }
                const entities = Array.from(this._providers.values());
                (entities[entities.length - 1] as Provider<any>).select().last();
            },
            single: ():
                | {
                      provider: Provider<any>;
                      next?: Provider<any>;
                      prev?: Provider<any>;
                      guid: string;
                  }
                | undefined => {
                if (this._providers.size === 0) {
                    return undefined;
                }
                const providers: Array<Provider<any>> = [];
                let next: Provider<any> | undefined;
                let prev: Provider<any> | undefined;
                Array.from(this._providers.values()).forEach(
                    (provider: Provider<any>, i: number, all: Array<Provider<any>>) => {
                        if (provider.select().single() !== undefined) {
                            providers.push(provider);
                            for (let k = i + 1; k <= all.length - 1; k += 1) {
                                if (next === undefined && all[k].entities().length > 0) {
                                    next = all[k];
                                }
                            }
                            for (let k = i - 1; k >= 0; k -= 1) {
                                if (prev === undefined && all[k].entities().length > 0) {
                                    prev = all[k];
                                }
                            }
                        }
                    },
                );
                if (providers.length !== 1) {
                    return undefined;
                }
                const guid: string | undefined = (providers[0] as Provider<any>)
                    .select()
                    .single()
                    ?.uuid();
                return guid === undefined
                    ? undefined
                    : {
                          provider: providers[0],
                          next: next,
                          prev: prev,
                          guid: guid,
                      };
            },
            getEntities: (): Array<Entity<any>> => {
                let entities: Entity<any>[] = [];
                this._providers.forEach((provider: Provider<any>) => {
                    entities = entities.concat(provider.select().getEntities());
                });
                return entities;
            },
            getProviders: (): Array<Provider<any>> => {
                const list: Provider<any>[] = [];
                this.PROVIDERS_ORDER.forEach((ref: ProviderData) => {
                    const provider: Provider<any> | undefined = this._providers.get(ref);
                    if (provider !== undefined && provider.select().getEntities().length !== 0) {
                        list.push(provider);
                    }
                });
                return list;
            },
        };
    }

    public edit(): {
        in: () => void;
        out: () => void;
    } {
        return {
            in: () => {
                let count: number = 0;
                this._providers.forEach((provider: Provider<any>) => {
                    count += provider.select().get().length;
                });
                if (count !== 1) {
                    return;
                }
                this._providers.forEach((provider: Provider<any>) => {
                    if (provider.select().get().length === 1) {
                        provider.edit().in();
                    }
                });
            },
            out: () => {
                this._providers.forEach((provider: Provider<any>) => {
                    provider.edit().out();
                });
            },
        };
    }

    private _store(): {
        load(): TSelectedEntities;
        save(entities: TSelectedEntities): void;
        restore(provider: string): void;
        drop(): void;
    } {
        const self = this;
        return {
            load: () => {
                return [];
                // if (self._session === undefined) {
                //     return [];
                // }
                // const stored: TSelectedEntities | undefined = self._session
                //     .getScope()
                //     .get<TSelectedEntities>(PROVIDERS_SCOPE_KEY);
                // return stored === undefined ? [] : stored.slice();
            },
            save: (entities: TSelectedEntities) => {
                console.log(`Not implemented: ${entities}`);
                // if (self._session === undefined) {
                //     return;
                // }
                // self._session
                //     .getScope()
                //     .set<TSelectedEntities>(PROVIDERS_SCOPE_KEY, entities.slice());
            },
            restore: (provider: string) => {
                const stored = self._store().load();
                this._providers.forEach((target: Provider<any>) => {
                    if (provider !== target.uuid) {
                        return;
                    }
                    target.select().drop(self.SENDER);
                    target.select().apply(self.SENDER, stored);
                    if (stored.length === 1) {
                        const entity = target.entities().find((e) => e.uuid() === stored[0]);
                        entity !== undefined &&
                            this.subjects.select.emit({
                                entity: entity,
                                provider: target,
                                guids: stored,
                            });
                    }
                });
                if (stored.length === 0) {
                    this.subjects.select.emit(undefined);
                }
            },
            drop: () => {
                // if (self._session === undefined) {
                //     return;
                // }
                // self._session.getScope().delete(PROVIDERS_SCOPE_KEY);
            },
        };
    }

    private _onSelectionEntity(event: ISelectEvent) {
        if (event.sender === this.SENDER) {
            // Ignore events triggered by holder
            return;
        }
        if (!this._keyboard.ctrl() && !this._keyboard.shift()) {
            this._providers.forEach((provider: Provider<any>) => {
                // Drop selection on all others providers
                if (provider.uuid !== event.provider.uuid) {
                    provider.select().drop(this.SENDER);
                }
            });
        } else if (this._keyboard.shift()) {
            this._providers.forEach((provider: Provider<any>) => {
                // Force selection
                provider.select().apply(this.SENDER, event.guids);
            });
        }
        let guids: string[] = [];
        this._providers.forEach((provider: Provider<any>) => {
            guids = guids.concat(provider.select().get());
        });
        if (guids.length === 1) {
            this._providers.forEach((provider: Provider<any>) => {
                if (provider.select().get().length === 1) {
                    this.subjects.select.emit({
                        entity: event.entity,
                        provider: provider,
                        guids: provider.select().get(),
                    });
                }
            });
        } else {
            this.subjects.select.emit(undefined);
        }
        this._providers.forEach((provider: Provider<any>) => {
            provider.setLastSelection(guids.length > 0 ? event.entity : undefined);
        });
        this._store().save(guids);
    }

    private _onContextMenuEvent(event: IContextMenuEvent) {
        const isActionAvailable = (
            action: EActions,
            insel: Array<Provider<any>>,
            _entities: Entity<any>[],
        ) => {
            let count: number = 0;
            insel.forEach((provider: Provider<any>) => {
                (provider.actions(event.entity, _entities) as any)[action] !== undefined &&
                    (count += 1);
            });
            return count === insel.length;
        };
        let entities = this.select().getEntities();
        if (entities.length === 0) {
            // Context menu is called without active selection
            // Set selection to target element
            event.provider.select().set({ guid: event.entity.uuid() });
            entities = [event.entity];
        } else if (entities.length === 1) {
            if (entities[0].uuid() !== event.entity.uuid()) {
                this.select().drop();
                event.provider.select().set({ guid: event.entity.uuid() });
                entities = [event.entity];
            }
        } else if (entities.length > 1) {
            if (entities.map((entity) => entity.uuid()).indexOf(event.entity.uuid()) === -1) {
                // Context menu is called out of selection
                this.select().drop();
                event.provider.select().set({ guid: event.entity.uuid() });
                entities = [event.entity];
            }
        }
        const providers = this.select().getProviders();
        const actions: {
            activate: boolean;
            deactivate: boolean;
            remove: boolean;
            edit: boolean;
        } = {
            activate: isActionAvailable(EActions.activate, providers, entities),
            deactivate: isActionAvailable(EActions.deactivate, providers, entities),
            remove: isActionAvailable(EActions.remove, providers, entities),
            edit: isActionAvailable(EActions.edit, providers, entities),
        };
        event.items = [];
        if (providers.length === 1 && entities.length === 1 && actions.edit) {
            event.items.push({
                caption: 'Edit',
                handler: () => {
                    const actions = providers[0].actions(event.entity, entities);
                    actions.edit !== undefined && actions.edit();
                },
                shortcut: 'Enter',
            });
        }

        event.items.length > 0 &&
            event.items.push({
                /* Delimiter */
            });

        actions.activate &&
            event.items.push({
                caption: 'Activate',
                handler: () => {
                    providers.forEach((provider: Provider<any>) => {
                        const actions = provider.actions(event.entity, entities);
                        actions.activate !== undefined && actions.activate();
                    });
                },
            });
        actions.deactivate &&
            event.items.push({
                caption: 'Deactivate',
                handler: () => {
                    providers.forEach((provider: Provider<any>) => {
                        const actions = provider.actions(event.entity, entities);
                        actions.deactivate !== undefined && actions.deactivate();
                    });
                },
            });
        actions.remove &&
            event.items.push({
                caption: 'Remove',
                handler: () => {
                    providers.forEach((provider: Provider<any>) => {
                        const actions = provider.actions(event.entity, entities);
                        actions.remove !== undefined && actions.remove();
                    });
                },
            });

        event.items.length > 0 &&
            event.items.push({
                /* Delimiter */
            });

        actions.activate &&
            event.items.push({
                caption: 'Activate All',
                handler: () => {
                    providers.forEach((provider: Provider<any>) => {
                        const actions = provider.actions(event.entity, provider.entities());
                        actions.activate !== undefined && actions.activate();
                    });
                },
            });
        actions.deactivate &&
            event.items.push({
                caption: 'Deactivate All',
                handler: () => {
                    providers.forEach((provider: Provider<any>) => {
                        const actions = provider.actions(event.entity, provider.entities());
                        actions.deactivate !== undefined && actions.deactivate();
                    });
                },
            });
        actions.remove &&
            event.items.push({
                caption: 'Remove All',
                handler: () => {
                    providers.forEach((provider: Provider<any>) => {
                        const actions = provider.actions(event.entity, provider.entities());
                        actions.remove !== undefined && actions.remove();
                    });
                },
            });
        this._providers.forEach((provider: Provider<any>) => {
            const custom: IMenuItem[] = provider.getContextMenuItems(
                event.entity,
                this.select().getEntities(),
            );
            if (custom.length > 0 && event.items !== undefined) {
                event.items.push({
                    /* Delimiter */
                });
                event.items = event.items.concat(custom);
            }
        });
        this.subjects.context.emit(event);
    }

    private _onDoubleclickEvent(event: IDoubleclickEvent) {
        event.provider.search(event.entity);
    }

    private _onChange() {
        this._providers.forEach((p) => p.updatePanels());
        this.subjects.change.emit();
    }

    private _onReload(provider: string) {
        this._store().restore(provider);
    }

    private _onEdit(guid: string | undefined) {
        this.subjects.edit.emit(guid);
    }
}
