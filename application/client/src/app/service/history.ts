import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from '@platform/entity/service';
import { services } from '@register/services';
import { bridge } from '@service/bridge';
import { ilc, Channel } from '@service/ilc';
import { Session } from './session/session';
import { HistorySession } from './history/session';
import { StorageCollections } from './history/storage.collections';
import { StorageDefinitions } from './history/storage.definitions';
import { Provider } from './history/provider';

@DependOn(bridge)
@SetupService(services['history'])
export class Service extends Implementation {
    protected channel!: Channel;
    protected readonly provider: Provider;

    public readonly collections: StorageCollections;
    public readonly definitions: StorageDefinitions;
    public readonly sessions: Map<string, HistorySession> = new Map();

    constructor() {
        super();
        this.definitions = new StorageDefinitions();
        this.collections = new StorageCollections(this.definitions);
        this.provider = new Provider(this.collections, this.definitions);
    }

    public override async ready(): Promise<void> {
        await this.collections.load();
        await this.definitions.load();
        this.channel = ilc.channel(`History`, this.log());
        this.channel.session.created((session) => {
            this.sessions.set(
                session.uuid(),
                new HistorySession(session, {
                    collections: this.collections,
                    definitions: this.definitions,
                }),
            );
        });
        this.channel.session.closing((session) => {
            if (!(session instanceof Session)) {
                return;
            }
            this.save()
                .catch((err) => this.log().error(`Fail to save session state: ${err.message}`))
                .finally(() => {
                    const history = this.sessions.get(session.uuid());
                    if (history === undefined) {
                        return;
                    }
                    history.destroy();
                    this.sessions.delete(session.uuid());
                });
        });
        return Promise.resolve();
    }

    public async save(): Promise<void> {
        return Promise.all([this.collections.save(), this.definitions.save()]).then(
            (_) => undefined,
        );
    }

    public get(session: Session | string): HistorySession | undefined {
        return this.sessions.get(session instanceof Session ? session.uuid() : session);
    }

    public export(uuids: string[], filename: string): Promise<void> {
        return this.provider.export(uuids, filename);
    }

    public import(filename: string): Promise<string[]> {
        return this.provider.import(filename);
    }
}
export interface Service extends Interface {}
export const history = register(new Service());
