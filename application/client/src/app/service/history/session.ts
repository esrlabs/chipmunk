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
        this.definitions = new Definitions();
        this.storage = storage;
        this.session = session;
        this.setLoggerName(`History: ${this.session.uuid()}`);
        this.session.stream.subjects.get().source.subscribe(this.handleNewSource.bind(this));
        this.collections = this.setCollection(Collections.from(session, storage.collections));
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
                if (related !== undefined) {
                    this.setCollection(related);
                    this.collections.applyTo(this.session, this.definitions.list());
                } else {
                    this.subjects.get().suitable.emit(new Suitable());
                }
                return related !== undefined;
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

    protected setCollection(collections: Collections): Collections {
        this.unsubscribe();
        this.collections = collections;
        this.session.stream.subjects.get().source.subscribe(this.handleNewSource.bind(this));
        this.collections.subscribe(this, this.session);
        this.register(
            this.collections.updated.subscribe(() => {
                this.collections.updateUuid(this.storage.collections.update(this.collections));
                this.save();
            }),
        );
        return collections;
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
    }

    public find(): {
        related(): Collections | undefined;
        suitable(): Suitable;
        all(): Collections[];
        named(): Collections[];
    } {
        return {
            related: (): Collections | undefined => {
                const related = this.storage.collections.find(this.definitions.list()).related();
                related.sort((a, b) => (a.last < b.last ? 1 : -1));
                return related.length === 0 ? undefined : related[0];
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
        this.setCollection(collection);
        this.definitions.list().forEach((def) => {
            this.collections.bind(def);
        });
        this.collections.applyTo(this.session, this.definitions.list());
    }

    public clear() {
        this.storage.collections.clear();
    }
}
export interface HistorySession extends LoggerInterface {}
