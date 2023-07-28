import {
    Provider,
    ProviderConstructor,
    ProviderData,
    ISelectEvent,
    IContextMenuEvent,
    EActions,
    IDoubleclickEvent,
} from './definitions/provider';
import { Subject, Subjects } from '@platform/env/subscription';
import { Session } from '@service/session/session';
import { KeyboardListener } from './definitions/keyboard.listener';
import { IMenuItem } from '@ui/service/contextmenu';
import { Entity } from './definitions/entity';
import { unique } from '@platform/env/sequence';
import { Logger } from '@platform/log';
import { ProvidersEvents } from './definitions/events';
import { history } from '@service/history';
import { bridge } from '@service/bridge';
import { HistorySession } from '@service/history/session';
import { Notification, notifications } from '@ui/service/notifications';

type TSelectedEntities = string[];

export class Providers {
    public readonly subjects: Subjects<ProvidersEvents> = new Subjects({
        select: new Subject(),
        context: new Subject(),
        doubleclick: new Subject(),
        change: new Subject(),
        edit: new Subject(),
        dragging: new Subject(),
    });
    public readonly session: Session;
    public readonly logger: Logger;

    private readonly SENDER = unique();
    private readonly PROVIDERS_ORDER: ProviderData[] = [
        ProviderData.filters,
        ProviderData.charts,
        ProviderData.ranges,
        ProviderData.disabled,
    ];

    private readonly _providers: Map<ProviderData, Provider<any>> = new Map();
    private readonly _keyboard: KeyboardListener = new KeyboardListener();

    constructor(session: Session, logger: Logger) {
        this.session = session;
        this.logger = logger;
    }

    public destroy() {
        this.subjects.destroy();
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
        const provider = new providerConstructor(this.session, this.logger);
        provider.setKeyboardListener(this._keyboard);
        provider.setProvidersGetter(this.list.bind(this));
        provider.setProvidersEvents(this.subjects);
        provider.subjects.get().selection.subscribe(this._onSelectionEntity.bind(this));
        provider.subjects.get().context.subscribe(this._onContextMenuEvent.bind(this));
        provider.subjects.get().doubleclick.subscribe(this._onDoubleclickEvent.bind(this));
        provider.subjects.get().change.subscribe(this._onChange.bind(this));
        provider.subjects.get().reload.subscribe(this._onReload.bind(this));
        provider.subjects.get().edit.subscribe(this._onEdit.bind(this));
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
                            this.subjects.get().select.emit({
                                entity: entity,
                                provider: target,
                                guids: stored,
                            });
                    }
                });
                if (stored.length === 0) {
                    this.subjects.get().select.emit(undefined);
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
                    this.subjects.get().select.emit({
                        entity: event.entity,
                        provider: provider,
                        guids: provider.select().get(),
                    });
                }
            });
            this.session.charts.selecting().set(guids[0]);
        } else {
            this.subjects.get().select.emit(undefined);
            this.session.charts.selecting().set(undefined);
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

        this.contextMenuOptions(event.items);

        this.subjects.get().context.emit(event);
    }


    public contextMenuOptions(items: IMenuItem[]): IMenuItem[] {
        const historySession = history.get(this.session);
        if(historySession === undefined) {
            this.logger.error('History session is not defined');
            return items;
        }
        items.push({ /* Delimiter */ });
        const store = this.session.search.store();
        const showExport: boolean = (store.filters().get().length + store.charts().get().length + store.disabled().get().length) !== 0;
        showExport && items.push(
        {
            caption: 'Export All to File',
            handler: () => this.filters(historySession).export(),
        });
        items.push(
        {
            caption: 'Import from File',
            handler: () => this.filters(historySession).import(),
        });
        return items;
    }

    protected filters(historySession: HistorySession): { import(): void; export(): void } {
        return {
            import: (): void => {
                bridge.files().select.text()
                .then(file => {
                    if (file.length !== 1) {
                        this.logger.error('No file selected');
                        return;
                    }
                    history.import(file[0].filename)
                    .then((uuids: string[]) => {
                        if (uuids.length === 0) {
                            this.logger.warn('File does not have a collection');
                            return;
                        }
                        if (uuids.length > 1) {
                            this.session.switch().toolbar.presets();
                            return;
                        } else {
                            const collection = history.collections.get(uuids[0]);
                            if (collection === undefined) {
                                this.logger.error(`Cannot find imported collection with UUID: ${uuids[0]}`);
                                return;
                            }
                            historySession.apply(collection);
                        }
                    })
                    .catch(error => this.logAndNotifyError(error));
                })
                .catch(error => this.logAndNotifyError(error))
            },
            export: (): void => {
                bridge.files().select.save()
                .then((filename: string | undefined) => {
                    if (filename === undefined)
                        return;
                    history.export([historySession.collections.uuid], filename)
                    .catch(error => this.logAndNotifyError(error))
                })
                .catch(error => this.logAndNotifyError(error))
            }
        };
    }

    protected logAndNotifyError(error: any): void {
        this.logger.error(error.message);
        notifications.notify(
            new Notification({
                message: error.message,
                session: this.session.uuid(),
                actions: []
            })
        );
    }

    private _onDoubleclickEvent(event: IDoubleclickEvent) {
        event.provider.search(event.entity);
    }

    private _onChange() {
        this._providers.forEach((p) => p.updatePanels());
        this.subjects.get().change.emit();
    }

    private _onReload(provider: string) {
        this._store().restore(provider);
    }

    private _onEdit(guid: string | undefined) {
        this.subjects.get().edit.emit(guid);
    }
}
