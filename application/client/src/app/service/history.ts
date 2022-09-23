import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from '@platform/entity/service';
import { services } from '@register/services';
import { bridge } from '@service/bridge';
import { session } from '@service/session';
import { ilc, Emitter, Channel, Declarations } from '@service/ilc';
import { Session } from './session/session';

// import { error } from '@platform/env/logger';
import { SessionCollection } from './history/session';
import { Definitions } from './history/definitions';
import { Definition } from './history/definition';

// import { FilterRequest } from './session/dependencies/search/filters/request';

// const STORAGE_KEY = 'recent_used_filters';

@DependOn(bridge)
@SetupService(services['history'])
export class Service extends Implementation {
    private _channel!: Channel;

    public collections: Map<string, SessionCollection> = new Map();
    public definitions: Definitions = new Definitions();

    public override ready(): Promise<void> {
        this._channel = ilc.channel(`History`, this.log());
        this._channel.session.closing((session) => {
            if (session instanceof Session) {
                const collection = SessionCollection.from(session);
                const defs = this.definitions.addFrom(session);
                console.log(defs);
                console.log(collection);
            }

            debugger;
        });
        return Promise.resolve();
    }

    public async save(session: Session): Promise<void> {
        const collection = SessionCollection.from(session);

        const filters = session.search.store().filters().get();
        const disabled = session.search.store().disabled().get();

        if (filters.length === 0) {
            return Promise.resolve();
        }
        const defs = session.stream
            .observe()
            .sources()
            .map((s) => Definition.fromDataSource(s));
        if (defs.length === 0) {
            return Promise.resolve();
        }
        const definitions = await this.definitions.add(defs);

        return Promise.resolve();
    }
}
export interface Service extends Interface {}
export const history = register(new Service());
