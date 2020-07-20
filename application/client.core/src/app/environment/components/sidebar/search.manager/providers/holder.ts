import { Provider, EProviders, ISelectEvent } from './provider';
import { Subject, Observable, Subscription } from 'rxjs';
import { KeyboardListener } from './keyboard.listener';

import * as Toolkit from 'chipmunk.client.toolkit';

export class Providers {

    private readonly SENDER = Toolkit.guid();

    private _providers: Map<EProviders, Provider<any>> = new Map();
    private _subscriptions: { [key: string]: Subscription } = {};
    private _selsubs: { [key: string]: Subscription } = {};
    private _keyboard: KeyboardListener = new KeyboardListener();
    private _subjects: {
        singleSelection: Subject<ISelectEvent | undefined>,
    } = {
        singleSelection: new Subject(),
    };

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._providers.forEach((provider: Provider<any>) => {
            provider.destroy();
        });
        this._keyboard.destroy();
    }

    public getObservable(): {
        singleSelection: Observable<ISelectEvent | undefined>,
    } {
        return {
            singleSelection: this._subjects.singleSelection.asObservable(),
        };
    }

    public add(name: EProviders, provider: Provider<any>): boolean {
        if (this._providers.has(name)) {
            return false;
        }
        provider.setKeyboardListener(this._keyboard);
        this._selsubs[name] = provider.getObservable().selection.subscribe(this._onSelectionEntity.bind(this));
        this._providers.set(name, provider);
    }

    public all(): any[] {
        let entries: any[] = [];
        this._providers.forEach((provider: Provider<any>) => {
            entries = entries.concat(provider.get());
        });
        return entries;
    }

    public list(): Map<EProviders, Provider<any>> {
        return this._providers;
    }

    public select(): {
        next: () => void,
        prev: () => void,
        drop: () => void,
        first: () => void,
        last: () => void,
        single: () => { provider: Provider<any>, next?: Provider<any>, prev?: Provider<any>, guid: string } | undefined,
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
                    if (i + 1 <= all.length - 1) {
                        next = all[i + 1];
                    }
                    if (i - 1 >= 0) {
                        prev = all[i - 1];
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
        };
    }

    public editIn() {
        let count: number = 0;
        this._providers.forEach((provider: Provider<any>) => {
            count += provider.select().get().length;
        });
        if (count !== 1) {
            return;
        }
        this._providers.forEach((provider: Provider<any>) => {
            if (provider.select().get().length === 1) {
                provider.editIn();
            }
        });
    }

    private _onSelectionEntity(event: ISelectEvent) {
        if (event.sender === this.SENDER) {
            // Ignore events triggered by holder
            return;
        }
        if (!this._keyboard.ctrl()) {
            this._providers.forEach((provider: Provider<any>) => {
                // Drop selection on all others providers
                if (provider.getGuid() !== event.provider.getGuid()) {
                    provider.select().drop(this.SENDER);
                }
            });
        }
        let guids: string[] = [];
        this._providers.forEach((provider: Provider<any>) => {
            guids = guids.concat(provider.select().get());
        });
        if (guids.length === 1) {
            this._providers.forEach((provider: Provider<any>) => {
                if (provider.select().get().length === 1) {
                    this._subjects.singleSelection.next({
                        provider: provider,
                        guids: provider.select().get(),
                    });
                }
            });
        } else {
            this._subjects.singleSelection.next(undefined);
        }
    }

}
