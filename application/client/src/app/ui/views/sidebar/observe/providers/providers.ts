import { Provider, ProviderConstructor } from './provider';
import { Session } from '@service/session/session';
import { Logger } from '@platform/log';
import { Subscriber } from '@platform/env/subscription';
import { Base as BaseState } from '../states/state';
import { ParserName, Origin } from '@platform/types/observe';

import { PROVIDERS } from './implementations';

export class Providers extends Subscriber {
    public readonly session: Session;
    public readonly logger: Logger;

    public readonly list: Map<string, Provider<BaseState>> = new Map();

    constructor(session: Session, logger: Logger) {
        super();
        this.session = session;
        this.logger = logger;
        PROVIDERS.forEach((providerConstructor: ProviderConstructor) => {
            const provider = new providerConstructor(session, logger);
            this.list.set(provider.uuid, provider.setPanels());
        });
        this.register(
            session.stream.subjects.get().sources.subscribe(() => {
                this.update();
            }),
            session.stream.subjects.get().finished.subscribe(() => {
                this.update();
            }),
        );
        this.update();
    }

    public destroy() {
        this.unsubscribe();
        this.list.forEach((provider: Provider<BaseState>) => {
            provider.destroy();
        });
    }

    public get(): {
        parser(): ParserName | Error;
        origin(): Origin | Error;
    } {
        let parser: ParserName | Error = new Error(``);
        let origin: Origin | Error = new Error(``);
        this.list.forEach((provider) => {
            if (parser instanceof Error) {
                parser = provider.get().parser();
            }
            if (origin instanceof Error) {
                origin = provider.get().origin();
            }
        });
        return {
            parser: (): ParserName | Error => {
                let parser: ParserName | Error = new Error(``);
                this.list.forEach((provider) => {
                    if (parser instanceof Error) {
                        parser = provider.get().parser();
                    }
                });
                return parser;
            },
            origin: (): Origin | Error => {
                let origin: Origin | Error = new Error(``);
                this.list.forEach((provider) => {
                    if (origin instanceof Error) {
                        origin = provider.get().origin();
                    }
                });
                return origin;
            },
        };
    }

    public getNewSourceError(): Error | undefined {
        let error: Error | undefined;
        this.list.forEach((provider: Provider<BaseState>) => {
            if (error !== undefined) {
                return;
            }
            error = provider.getNewSourceError();
        });
        return error;
    }

    public count(): number {
        let count = 0;
        this.list.forEach((provider) => {
            count += provider.count();
        });
        return count;
    }

    protected update() {
        const sources = this.session.stream.observe().sources();
        this.list.forEach((provider, _uuid) => {
            provider.update(sources).subjects.get().updated.emit();
        });
    }
}
