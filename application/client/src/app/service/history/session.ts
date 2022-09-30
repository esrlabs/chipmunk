import { Collections } from './collections';
import { Definitions } from './definitions';
import { Definition } from './definition';
import { Session } from '../session/session';
import { StorageCollections } from './storage.collections';
import { StorageDefinitions } from './storage.definitions';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { DataSource } from '@platform/types/observe';
import { Subscriber } from '@platform/env/subscription';
import { Subjects, Subject } from '@platform/env/subscription';
import { Suitable, SuitableGroup } from './suitable';

export { Suitable, SuitableGroup };

@SetupLogger()
export class HistorySession extends Subscriber {
    protected readonly storage: {
        collections: StorageCollections;
        definitions: StorageDefinitions;
    };
    protected readonly session: Session;

    public readonly definitions: Definitions;
    public collections: Collections;
    public readonly subjects: Subjects<{
        suitable: Subject<Suitable>;
    }> = new Subjects({
        suitable: new Subject<Suitable>(),
    });

    constructor(
        session: Session,
        storage: {
            collections: StorageCollections;
            definitions: StorageDefinitions;
        },
    ) {
        super();
        this.collections = Collections.from(session, storage.collections);
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
                definition = this.storage.definitions.update(definition);
                this.definitions.add(definition);
                this.collections.bind(definition);
                this.save();
                this.check().all();
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

    protected check(): {
        related(): boolean;
        suitable(): void;
        all(): void;
    } {
        return {
            related: (): boolean => {
                const related = this.find().related();
                if (related.length === 1) {
                    this.session.search
                        .store()
                        .filters()
                        .overwrite(related[0].collections.filters.as().elements(), true);
                    this.session.search
                        .store()
                        .disabled()
                        .overwrite(related[0].collections.disabled.as().elements(), true);
                    this.collections = related[0];
                    this.session.search.store().filters().refresh();
                    this.session.search.store().disabled().refresh();
                } else if (related.length > 0) {
                    this.subjects.get().suitable.emit(new Suitable());
                }
                return related.length > 0;
            },
            suitable: (): void => {
                this.subjects.get().suitable.emit(this.find().suitable());
            },
            all: (): void => {
                if (this.check().related()) {
                    return;
                }
                this.check().suitable();
            },
        };
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
    }

    public find(): {
        related(): Collections[];
        suitable(): Suitable;
        all(): Collections[];
        named(): Collections[];
    } {
        return {
            related: (): Collections[] => {
                return this.storage.collections.find(this.definitions.list()).related();
            },
            suitable: (): Suitable => {
                return this.storage.collections.find(this.definitions.list()).suitable();
            },
            all: (): Collections[] => {
                return this.storage.collections.find().all();
            },
            named: (): Collections[] => {
                return this.storage.collections.find().named();
            },
        };
    }

    public apply(collection: Collections) {
        this.storage.collections.used(collection.uuid);
        this.session.search
            .store()
            .filters()
            .overwrite(collection.collections.filters.as().elements(), true);
        this.session.search
            .store()
            .disabled()
            .overwrite(collection.collections.disabled.as().elements(), true);
        this.collections = collection;
        this.definitions.list().forEach((def) => {
            this.collections.bind(def);
        });
        this.session.search.store().filters().refresh();
        this.session.search.store().disabled().refresh();
    }

    public clear() {
        this.storage.collections.clear();
    }
}
export interface HistorySession extends LoggerInterface {}
