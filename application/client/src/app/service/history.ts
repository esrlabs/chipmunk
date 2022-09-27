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

// import { error } from '@platform/env/logger';
import { HistorySession } from './history/session';
import { StorageCollections } from './history/storage.collections';
import { StorageDefinitions } from './history/storage.definitions';

// import { FilterRequest } from './session/dependencies/search/filters/request';

// const STORAGE_KEY = 'recent_used_filters';

@DependOn(bridge)
@SetupService(services['history'])
export class Service extends Implementation {
    private _channel!: Channel;

    public collections: StorageCollections = new StorageCollections();
    public definitions: StorageDefinitions = new StorageDefinitions();

    public sessions: Map<string, HistorySession> = new Map();

    public override async ready(): Promise<void> {
        await this.collections.load();
        await this.definitions.load();
        this._channel = ilc.channel(`History`, this.log());
        this._channel.session.created((session) => {
            this.sessions.set(
                session.uuid(),
                new HistorySession(session, {
                    collections: this.collections,
                    definitions: this.definitions,
                }),
            );
        });
        this._channel.session.closing((session) => {
            if (!(session instanceof Session)) {
                return;
            }
            this.save(session)
                .catch((err) => this.log().error(`Fail to save session state: ${err.message}`))
                .finally(() => {
                    const history = this.sessions.get(session.uuid());
                    if (history === undefined) {
                        return;
                    }
                    history.unsubscribe();
                    this.sessions.delete(session.uuid());
                });
        });
        return Promise.resolve();
    }

    public async save(_session: Session): Promise<void> {
        // const collection = Collection.from(session);
        // if (collection.isEmpty()) {
        //     return;
        // }
        // // const defs = await this.definitions.addFrom(session);
        return Promise.resolve();
    }
}
export interface Service extends Interface {}
export const history = register(new Service());
