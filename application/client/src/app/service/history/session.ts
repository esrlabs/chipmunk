import { Collections } from './collections';
import { Definitions } from './definitions';
import { Definition } from './definition';
import { Session } from '../session/session';
import { StorageCollections } from './storage.collections';
import { StorageDefinitions } from './storage.definitions';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { DataSource } from '@platform/types/observe';
import { Subscriber } from '@platform/env/subscription';

@SetupLogger()
export class HistorySession extends Subscriber {
    public definitions: Definitions;
    public collections: Collections;
    protected storage: {
        collections: StorageCollections;
        definitions: StorageDefinitions;
    };
    protected session: Session;

    constructor(
        session: Session,
        storage: {
            collections: StorageCollections;
            definitions: StorageDefinitions;
        },
    ) {
        super();
        this.collections = Collections.from(session);
        this.definitions = new Definitions();
        this.storage = storage;
        this.session = session;
        this.setLoggerName(`History: ${this.session.uuid()}`);
        this.session.stream.subjects.get().source.subscribe(this.handleNewSource.bind(this));
        this.register(
            this.session.search
                .store()
                .filters()
                .subjects.update.subscribe(this.handleFiltersUpdates.bind(this)),
        );
        this.register(
            this.session.search
                .store()
                .disabled()
                .subjects.update.subscribe(this.handleDisabledUpdates.bind(this)),
        );
    }

    protected handleNewSource(source: DataSource) {
        Definition.fromDataSource(source)
            .then((definition) => {
                definition = this.storage.definitions.add(definition);
                this.definitions.add(definition);
                this.collections.bind(definition);
                this.save();
                this.find().related();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get definition of source: ${err.message}`);
            });
    }

    protected handleFiltersUpdates() {
        this.collections
            .update(this.session)
            .filters()
            .uuid(this.storage.collections.update(this.collections));
        this.save();
    }

    protected handleDisabledUpdates() {
        this.collections
            .update(this.session)
            .disabled()
            .uuid(this.storage.collections.update(this.collections));
        this.save();
    }

    protected save() {
        if (this.collections.isEmpty()) {
            return;
        }
        Promise.all([
            this.storage.collections.save().catch((err: Error) => {
                this.log().error(`Fail to save collections storage: ${err.message}`);
            }),
            this.storage.definitions.save().catch((err: Error) => {
                this.log().error(`Fail to save definitions storage: ${err.message}`);
            }),
        ]).catch((err: Error) => {
            this.log().error(`Fail to save history storage: ${err.message}`);
        });
    }

    protected find(): {
        related(): boolean;
        suitable(): boolean;
    } {
        return {
            related: (): boolean => {
                const suitable = this.storage.collections.find(this.definitions.list());
                if (suitable !== undefined) {
                    if (suitable.length === 1) {
                        this.session.search
                            .store()
                            .filters()
                            .overwrite(suitable[0].collections.filters.as().elements());
                        this.session.search
                            .store()
                            .disabled()
                            .overwrite(suitable[0].collections.disabled.as().elements());
                    }
                }
                return suitable.length > 0;
            },
            suitable: (): boolean => {
                return false;
            },
        };
    }
}
export interface HistorySession extends LoggerInterface {}
