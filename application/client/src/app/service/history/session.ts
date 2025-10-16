import { Collections } from './collections';
import { Definitions } from './definitions';
import { Definition } from './definition';
import { Session } from '../session/session';
import { StorageCollections } from './storage.collections';
import { StorageDefinitions } from './storage.definitions';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber } from '@platform/env/subscription';
import { Subjects, Subject } from '@platform/env/subscription';
import { Suitable, SuitableGroup } from './suitable';
import { LockToken } from '@platform/env/lock.token';
import { cli } from '@service/cli';

import * as $ from '@platform/types/observe';

export { Suitable, SuitableGroup };

@SetupLogger()
export class HistorySession extends Subscriber {
    protected readonly storage: {
        collections: StorageCollections;
        definitions: StorageDefinitions;
    };
    protected readonly session: Session;
    protected readonly sources: string[] = [];
    protected readonly globals: Subscriber = new Subscriber();
    protected readonly locker: LockToken = new LockToken(true);
    protected readonly pendings: $.Observe[] = [];
    protected checked: boolean = false;

    public readonly definitions: Definitions;
    public collections: Collections;
    public readonly subjects: Subjects<{
        suitable: Subject<Suitable>;
        checked: Subject<void>;
    }> = new Subjects({
        suitable: new Subject<Suitable>(),
        checked: new Subject<void>(),
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
        this.collections = this.setCollection(Collections.from(session, storage.collections));
        this.globals.register(
            this.session.stream.subjects.get().started.subscribe(this.handleNewSource.bind(this)),
            this.session.stream.subjects.get().readable.subscribe(() => {
                this.locker.unlock();
                this.pendings
                    .splice(0, this.pendings.length)
                    .forEach(this.handleNewSource.bind(this));
            }),
        );
    }

    protected handleNewSource(source: $.Observe) {
        if (this.locker.isLocked()) {
            this.pendings.push(source);
            return;
        }
        Definition.fromDataSource(source)
            .then((definition) => {
                definition = this.storage.definitions.update(definition);
                this.definitions.add(definition);
                this.collections.bind(definition);
                if (cli.isFiltersImported(this.session.uuid())) {
                    // Filters are imported from CLI. Recent filters/charts should not
                    // be applied
                    return;
                }
                this.save();
                this.check().all();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get definition of source: ${err.message}`);
            });
    }

    protected save() {
        if (this.collections.isEmpty()) {
            this.storage.collections.clean().catch((err: Error) => {
                this.log().error(`Fail to save collections storage: ${err.message}`);
            });
        } else {
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
    }

    public check(): {
        related(): boolean;
        suitable(): void;
        all(): void;
        done(): boolean;
        confirm(): void;
    } {
        return {
            related: (): boolean => {
                const related = this.find().related();
                if (related !== undefined) {
                    if (related.used === 0) {
                        this.storage.collections.used(related.uuid);
                    }
                    this.setCollection(related);
                    this.collections
                        .applyTo(this.session, this.definitions.list())
                        .catch((err: Error) => {
                            this.log().warn(`Fail to apply collection: ${err.message}`);
                        })
                        .finally(() => {
                            this.check().confirm();
                        });
                } else {
                    this.subjects.get().suitable.emit(new Suitable());
                }
                return related !== undefined;
            },
            suitable: (): void => {
                this.subjects.get().suitable.emit(this.find().suitable());
                this.check().confirm();
            },
            all: (): void => {
                if (this.check().related()) {
                    return;
                }
                this.check().suitable();
            },
            done: (): boolean => {
                return this.checked;
            },
            confirm: (): void => {
                this.checked = true;
                this.subjects.get().checked.emit();
            },
        };
    }

    protected setCollection(collections: Collections): Collections {
        this.unsubscribe();
        this.collections = collections;
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
        this.globals.unsubscribe();
        this.subjects.destroy();
    }

    public find(): {
        related(): Collections | undefined;
        suitable(): Suitable;
        all(): Collections[];
        named(): Collections[];
        byTimeStamp(tm: number): Collections[];
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
            byTimeStamp: (tm: number): Collections[] => {
                return this.storage.collections.find().byTimeStamp(tm);
            },
        };
    }

    public apply(collection: Collections) {
        let storage_collection = this.storage.collections.get(collection.uuid);

        if (storage_collection === undefined) {
            this.storage.collections.insert(collection);
        } 
        if (storage_collection !== undefined && storage_collection.used > 0) {
            return;
        }
        this.storage.collections.used(collection.uuid);
        this.setCollection(collection);
        this.definitions.list().forEach((def) => {
            this.collections.bind(def);
        });
        this.collections.applyTo(this.session, this.definitions.list()).catch((err: Error) => {
            this.log().warn(`Fail to apply collection: ${err.message}`);
        });
    }

    public clear() {
        this.storage.collections.clear();
    }
}
export interface HistorySession extends LoggerInterface {}
