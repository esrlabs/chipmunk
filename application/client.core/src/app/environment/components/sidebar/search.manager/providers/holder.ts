import { Provider, EProviders, ISelectEvent, IContextMenuEvent, EActions } from './provider';
import { Subject, Observable, Subscription } from 'rxjs';
import { KeyboardListener } from './keyboard.listener';

import * as Toolkit from 'chipmunk.client.toolkit';
import { IMenuItem } from 'src/app/environment/services/standalone/service.contextmenu';
import { Entity } from './entity';

export class Providers {

    private readonly SENDER = Toolkit.guid();
    private readonly PROVIDERS_ORDER: EProviders[] = [EProviders.filters, EProviders.charts, EProviders.ranges, EProviders.disabled];

    private _providers: Map<EProviders, Provider<any>> = new Map();
    private _subscriptions: { [key: string]: Subscription } = {};
    private _selsubs: { [key: string]: Subscription } = {};
    private _keyboard: KeyboardListener = new KeyboardListener();
    private _subjects: {
        select: Subject<ISelectEvent | undefined>,
        context: Subject<IContextMenuEvent>,
    } = {
        select: new Subject(),
        context: new Subject(),
    };

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        Object.keys(this._selsubs).forEach((key: string) => {
            this._selsubs[key].unsubscribe();
        });
        this._providers.forEach((provider: Provider<any>) => {
            provider.destroy();
        });
        this._keyboard.destroy();
    }

    public getObservable(): {
        select: Observable<ISelectEvent | undefined>,
        context: Observable<IContextMenuEvent>,
    } {
        return {
            select: this._subjects.select.asObservable(),
            context: this._subjects.context.asObservable(),
        };
    }

    public add(name: EProviders, provider: Provider<any>): boolean {
        if (this._providers.has(name)) {
            return false;
        }
        provider.setKeyboardListener(this._keyboard);
        provider.setProvidersGetter(this.list.bind(this));
        this._selsubs[`selection_${name}`] = provider.getObservable().selection.subscribe(this._onSelectionEntity.bind(this));
        this._selsubs[`context_${name}`] = provider.getObservable().context.subscribe(this._onContextMenuEvent.bind(this));
        this._providers.set(name, provider);
    }

    public all(): any[] {
        let entries: any[] = [];
        this.list().forEach((provider: Provider<any>) => {
            entries = entries.concat(provider.get());
        });
        return entries;
    }

    public list(): Provider<any>[] {
        const list: Provider<any>[] = [];
        this.PROVIDERS_ORDER.forEach((ref: EProviders) => {
            const provider: Provider<any> | undefined = this._providers.get(ref);
            if (provider !== undefined) {
                list.push(provider);
            }
        });
        return list;
    }

    public select(): {
        next: () => void,
        prev: () => void,
        drop: () => void,
        first: () => void,
        last: () => void,
        single: () => { provider: Provider<any>, next?: Provider<any>, prev?: Provider<any>, guid: string } | undefined,
        getEntities: () => Array<Entity<any>>,
        getProviders: () => Array<Provider<any>>,
    } {
        const single: () => { provider: Provider<any>, next?: Provider<any>, prev?: Provider<any>, guid: string } | undefined = () => {
            if (this._providers.size === 0) {
                return undefined;
            }
            const providers = [];
            let next;
            let prev;
            Array.from(this._providers.values()).forEach((provider: Provider<any>, i: number, all: Array<Provider<any>>) => {
                if (provider.select().single() !== undefined) {
                    providers.push(provider);
                    for (let k = i + 1; k <= all.length - 1; k += 1) {
                        if (next === undefined && all[k].get().length > 0) {
                            next = all[k];
                        }
                    }
                    for (let k = i - 1; k >= 0; k -= 1) {
                        if (prev === undefined && all[k].get().length > 0) {
                            prev = all[k];
                        }
                    }
                }
            });
            if (providers.length !== 1) {
                return undefined;
            }
            return { provider: providers[0], next: next, prev: prev, guid: (providers[0] as Provider<any>).select().single().getGUID() };
        };
        const drop: () => void = () => {
            this._providers.forEach((provider: Provider<any>) => {
                provider.select().drop(this.SENDER);
            });
        };
        const first: () => void = () => {
            if (this._providers.size === 0) {
                return;
            }
            (Array.from(this._providers.values())[0] as Provider<any>).select().first();
        };
        const last: () => void = () => {
            if (this._providers.size === 0) {
                return;
            }
            const entities = Array.from(this._providers.values());
            (entities[entities.length - 1] as Provider<any>).select().last();
        };
        return {
            next: () => {
                if (this._providers.size === 0) {
                    return;
                }
                const sel = single();
                if (sel === undefined) {
                    drop();
                    first();
                } else {
                    if (!sel.provider.select().next()) {
                        sel.provider.select().drop();
                        if (sel.next !== undefined) {
                            sel.next.select().first();
                        } else {
                            first();
                        }
                    }
                }
            },
            prev: () => {
                if (this._providers.size === 0) {
                    return;
                }
                const sel = single();
                if (sel === undefined) {
                    drop();
                    last();
                } else {
                    if (!sel.provider.select().prev()) {
                        sel.provider.select().drop();
                        if (sel.prev !== undefined) {
                            sel.prev.select().last();
                        } else {
                            last();
                        }
                    }
                }

            },
            drop: drop,
            first: first,
            last: last,
            single: single,
            getEntities: () => {
                let entities = [];
                this._providers.forEach((provider: Provider<any>) => {
                    entities = entities.concat(provider.select().getEntities());
                });
                return entities;
            },
            getProviders: () => {
                const list: Provider<any>[] = [];
                this.PROVIDERS_ORDER.forEach((ref: EProviders) => {
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
        in: () => void,
        out: () => void,
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

    private _onSelectionEntity(event: ISelectEvent) {
        if (event.sender === this.SENDER) {
            // Ignore events triggered by holder
            return;
        }
        if (!this._keyboard.ctrl() && !this._keyboard.shift()) {
            this._providers.forEach((provider: Provider<any>) => {
                // Drop selection on all others providers
                if (provider.getGuid() !== event.provider.getGuid()) {
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
                    this._subjects.select.next({
                        entity: event.entity,
                        provider: provider,
                        guids: provider.select().get(),
                    });
                }
            });
        } else {
            this._subjects.select.next(undefined);
        }
        this._providers.forEach((provider: Provider<any>) => {
            provider.setLastSelection(
                guids.length > 0 ? { provider: event.provider, entity: event.entity } : undefined,
            );
        });
    }

    private _onContextMenuEvent(event: IContextMenuEvent) {
        const isActionAvailable = (action: EActions, insel: Array<Provider<any>>) => {
            let count: number = 0;
            insel.forEach((provider: Provider<any>) => {
                provider.actions(undefined, [])[action] !== undefined && (count += 1);
            });
            return count === insel.length;
        };
        let entities = this.select().getEntities();
        if (entities.length === 0) {
            // Context menu is called without active selection
            // Set selection to target element
            event.provider.select().set(event.entity.getGUID());
            entities = [event.entity];
        } else if (entities.length === 1) {
            if (entities[0].getGUID() !== event.entity.getGUID()) {
                this.select().drop();
                event.provider.select().set(event.entity.getGUID());
                entities = [event.entity];
            }
        } else if (entities.length > 1) {
            if (entities.map((entity) => entity.getGUID()).indexOf(event.entity.getGUID()) === -1) {
                // Context menu is called out of selection
                this.select().drop();
                event.provider.select().set(event.entity.getGUID());
                entities = [event.entity];
            }
        }
        const providers = this.select().getProviders();
        const actions: {
            activate: boolean,
            deactivate: boolean,
            remove: boolean,
            edit: boolean,
        } = {
            activate: isActionAvailable(EActions.activate, providers),
            deactivate: isActionAvailable(EActions.deactivate, providers),
            remove: isActionAvailable(EActions.remove, providers),
            edit: isActionAvailable(EActions.edit, providers),
        };
        event.items = [];
        if (providers.length === 1 && entities.length === 1 && actions.edit) {
            event.items.push({
                caption: 'Edit',
                handler: () => {
                    providers[0].actions(event.entity, entities).edit();
                },
            });
        }

        event.items.length > 0 && event.items.push({ /* Delimiter */});

        actions.activate && event.items.push({
            caption: 'Activate',
            handler: () => {
                providers.forEach((provider: Provider<any>) => {
                    provider.actions(event.entity, entities).activate();
                });
            },
        });
        actions.deactivate && event.items.push({
            caption: 'Deactivate',
            handler: () => {
                providers.forEach((provider: Provider<any>) => {
                    provider.actions(event.entity, entities).deactivate();
                });
            },
        });
        actions.remove && event.items.push({
            caption: 'Remove',
            handler: () => {
                providers.forEach((provider: Provider<any>) => {
                    provider.actions(event.entity, entities).remove();
                });
            },
        });

        event.items.length > 0 && event.items.push({ /* Delimiter */});

        actions.activate && event.items.push({
            caption: 'Activate All',
            handler: () => {
                providers.forEach((provider: Provider<any>) => {
                    provider.actions(event.entity, provider.get()).activate();
                });
            },
        });
        actions.deactivate && event.items.push({
            caption: 'Deactivate All',
            handler: () => {
                providers.forEach((provider: Provider<any>) => {
                    provider.actions(event.entity, provider.get()).deactivate();
                });
            },
        });
        actions.remove && event.items.push({
            caption: 'Remove All',
            handler: () => {
                providers.forEach((provider: Provider<any>) => {
                    provider.actions(event.entity, provider.get()).remove();
                });
            },
        });
        this._providers.forEach((provider: Provider<any>) => {
            const custom: IMenuItem[] = provider.getContextMenuItems(event.entity, this.select().getEntities());
            if (custom.length > 0) {
                event.items.push({ /* Delimiter */});
                event.items = event.items.concat(custom);
            }
        });
        this._subjects.context.next(event);
    }

}
