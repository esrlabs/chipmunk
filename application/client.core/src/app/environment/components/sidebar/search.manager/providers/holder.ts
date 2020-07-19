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

    public editIn() {
        let count: number = 0;
        this._providers.forEach((provider: Provider<any>) => {
            count += provider.getSelection().length;
        });
        if (count !== 1) {
            return;
        }
        this._providers.forEach((provider: Provider<any>) => {
            if (provider.getSelection().length === 1) {
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
                    provider.dropSelection(this.SENDER);
                }
            });
        }
        let guids: string[] = [];
        this._providers.forEach((provider: Provider<any>) => {
            guids = guids.concat(provider.getSelection());
        });
        if (guids.length === 1) {
            this._providers.forEach((provider: Provider<any>) => {
                if (provider.getSelection().length === 1) {
                    this._subjects.singleSelection.next({
                        provider: provider,
                        guids: provider.getSelection(),
                    });
                }
            });
        } else {
            this._subjects.singleSelection.next(undefined);
        }
    }

}
