import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Provider, ProviderConstructor } from './provider';
import { Session } from '@service/session/session';
import { Subscriber } from '@platform/env/subscription';
import { Mutable } from '@platform/types/unity/mutable';
import { cutUuid } from '@log/index';

@SetupLogger()
export class Providers extends Subscriber {
    public readonly session!: Session;

    public readonly list: Map<string, Provider> = new Map();

    public init(session: Session) {
        // this.setLoggerName(`Providers: ${cutUuid(session.uuid())}`);
        // (this as Mutable<Providers>).session = session;
        // PROVIDERS.forEach((providerConstructor: ProviderConstructor) => {
        //     const provider = new providerConstructor(session, this.log());
        //     this.list.set(provider.uuid, provider.setPanels());
        // });
        // this.register(
        //     session.stream.subjects.get().sources.subscribe(() => {
        //         this.update();
        //     }),
        //     session.stream.subjects.get().finished.subscribe(() => {
        //         this.update();
        //     }),
        //     session.stream.sde.subjects.get().selected.subscribe(() => {
        //         this.update();
        //     }),
        // );
        // this.update();
    }

    public destroy() {
        this.unsubscribe();
        this.list.forEach((provider: Provider) => {
            provider.destroy();
        });
    }

    public getNewSourceError(): Error | undefined {
        let error: Error | undefined;
        this.list.forEach((provider: Provider) => {
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
        const operations = this.session.stream.observe().operations();
        this.list.forEach((provider, _uuid) => {
            provider.update(operations).subjects.get().updated.emit();
        });
    }
}
export interface Providers extends LoggerInterface {}
