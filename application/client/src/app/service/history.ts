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
import { Collections } from './history/collections';

// import { FilterRequest } from './session/dependencies/search/filters/request';

// const STORAGE_KEY = 'recent_used_filters';

@DependOn(bridge)
@SetupService(services['history'])
export class Service extends Implementation {
    private _channel!: Channel;

    public collections: StorageCollections;
    public definitions: StorageDefinitions;
    public sessions: Map<string, HistorySession> = new Map();

    constructor() {
        super();
        this.definitions = new StorageDefinitions();
        this.collections = new StorageCollections(this.definitions);
    }

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

    public export(uuid: string[], filename: string): Promise<void> {
        return bridge.entries({ file: filename }).overwrite(
            (
                uuid
                    .map((uuid) => {
                        return this.collections.get(uuid);
                    })
                    .filter((c) => c !== undefined) as Collections[]
            ).map((c, i) => {
                if (!c.hasName()) {
                    c.name = `imported_${i}`;
                }
                return c.clone().entry().to();
            }),
        );
    }

    public import(filename: string): Promise<void> {
        return bridge
            .entries({ file: filename })
            .get()
            .then((entries) => {
                this.collections.overwrite(
                    entries.map((entry) => Collections.from(entry, this.collections)),
                );
            });
    }
}
export interface Service extends Interface {}
export const history = register(new Service());
