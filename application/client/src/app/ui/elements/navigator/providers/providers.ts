import { Entity, TEntity } from './entity';
import { Entries } from './entries';
import { INoContentActions, IStatistics, Provider } from './provider';
import { Provider as ProviderFiles } from './provider.files';
import { Provider as ProviderRecent } from './provider.recent';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Observe } from '@platform/types/observe';

import * as wasm from '@loader/wasm';

import { IMenuItem } from '@ui/service/contextmenu';

const PROVIDERS = [ProviderRecent, ProviderFiles];

export class Providers {
    protected readonly providers: Provider<TEntity>[] = [];

    constructor(
        protected readonly ilc: IlcInterface & ChangesDetector,
        protected readonly matcher: wasm.Matcher,
        protected readonly entries: Entries,
        observe: Observe | undefined,
    ) {
        this.providers = PROVIDERS.map((Ref, i) => new Ref(ilc, i, observe));
        this.providers.forEach((provider: Provider<TEntity>, i: number) => {
            ilc.env().subscriber.register(
                provider.reload.subscribe(() => {
                    this.entries.remove(i);
                    provider
                        .load()
                        .then((entities) => {
                            this.entries.add(
                                i,
                                provider.title(),
                                entities.map((en) => new Entity(en, i, this.matcher)),
                            );
                        })
                        .catch((err: Error) => {
                            this.ilc
                                .log()
                                .error(
                                    `Fail to reload navigation provider data with: ${err.message}`,
                                );
                        });
                }),
            );
        });
    }

    public destroy() {
        this.providers.forEach((p) => p.destroy());
    }

    public load(): Promise<void> {
        return Promise.allSettled(this.providers.map((p) => p.load())).then(
            (results: PromiseSettledResult<TEntity[]>[]) => {
                results.forEach((result, i) => {
                    if (result.status === 'rejected') {
                        this.ilc
                            .log()
                            .error(`Fail to get navigation provider data with: ${result.reason}`);
                        return;
                    }
                    this.entries.add(
                        i,
                        this.providers[i].title(),
                        result.value.map((en) => new Entity(en, i, this.matcher)),
                    );
                });
            },
        );
    }

    public action(entity: TEntity): void {
        this.providers.forEach((p) => p.action(entity));
    }

    public stat(): IStatistics[] {
        return this.providers.map((p) => p.stat());
    }

    public getContextMenu(entity: TEntity, close?: () => void): IMenuItem[] {
        return this.providers.map((p) => p.getContextMenu(entity, close)).flat();
    }

    public getNoContentActions(index: number): INoContentActions {
        if (this.providers[index] === undefined) {
            throw new Error(`Fail to find provider with index ${index}.`);
        }
        return this.providers[index].getNoContentActions();
    }
}
