import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { Range, IRange } from '@platform/types/range';
import { cutUuid } from '@log/index';
import { Rank } from './rank';
import { GrabbedElement, SourceDefinition } from '@platform/types/bindings/miscellaneous';
import { ObserveOperation } from './observing/operation';
import { Info } from './info';
import { lockers } from '@ui/service/lockers';
import { Sde } from './observing/sde';
import { TextExportOptions } from '@platform/types/exporting';
import { SessionDescriptor } from '@platform/types/bindings';
import { SessionOrigin } from '../origin';
import { recent } from '@service/recent';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

export { ObserveOperation };

@SetupLogger()
export class Stream extends Subscriber {
    public readonly subjects: Subjects<{
        // Stream is updated (new rows came)
        updated: Subject<number>;
        // New observe operation is started
        started: Subject<ObserveOperation>;
        // Observe operation for source is finished
        finished: Subject<ObserveOperation>;
        // List of sources (observed operations has been changed)
        sources: Subject<void>;
        // Session rank is changed
        rank: Subject<number>;
        // Grabber is inited
        readable: Subject<void>;
        // New session descriptor has been gotten (describe a observe operation in human readable way)
        descriptor: Subject<SessionDescriptor>;
    }> = new Subjects({
        updated: new Subject<number>(),
        started: new Subject<ObserveOperation>(),
        finished: new Subject<ObserveOperation>(),
        sources: new Subject<void>(),
        rank: new Subject<number>(),
        readable: new Subject<void>(),
        descriptor: new Subject<SessionDescriptor>(),
    });
    private _len: number = 0;
    private _uuid!: string;
    private _info!: Info;

    public readonly operations: Map<string, ObserveOperation> = new Map();
    // Original (initial) session origin
    public origin: SessionOrigin | undefined;
    public readonly rank: Rank = new Rank();
    public sde!: Sde;

    public init(uuid: string, info: Info) {
        this.setLoggerName(`Stream: ${cutUuid(uuid)}`);
        this.sde = new Sde(uuid);
        this._uuid = uuid;
        this._info = info;
        this.register(
            Events.IpcEvent.subscribe(Events.Stream.Updated.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                this._len = event.rows;
                this.subjects.get().updated.emit(this._len);
                !this.subjects.get().readable.emitted() && this.subjects.get().readable.emit();
                if (this.rank.set(this._len.toString().length)) {
                    this.subjects.get().rank.emit(this.rank.len);
                }
            }),
        );
        this.register(
            Events.IpcEvent.subscribe(Events.Stream.SessionDescriptor.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                this.subjects.get().descriptor.emit(event.descriptor);
                const operation = this.operations.get(event.operation);
                if (!operation) {
                    this.log().error(
                        `Event "Stream.SessionDescriptor" emmited for operation "${event.operation}", but there no started operation with same uuid.`,
                    );
                    return;
                }
                operation.setDescriptor(event.descriptor);
            }),
            Events.IpcEvent.subscribe(Events.Observe.Started.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                this.operations.set(event.operation, new ObserveOperation(event.operation));
            }),
        );
        this.register(
            Events.IpcEvent.subscribe(Events.Observe.Finished.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                const operation = this.operations.get(event.operation);
                if (!operation) {
                    this.log().error(
                        `Event "Observe.Finished" emmited for operation "${event.operation}", but there no started operation with same uuid.`,
                    );
                    return;
                }
                operation.finish();
                this.sde.overwrite(this.operations);
                this.subjects.get().finished.emit(operation);
            }),
        );
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
        this.sde.destroy();
        this.operations.forEach((operation) => {
            operation.abort().catch((err: Error) => {
                this.log().warn(`Fail to abort operation: ${err.message}`);
            });
            operation.destroy();
        });
    }

    public getOrigin(): SessionOrigin | undefined {
        return this.origin;
    }

    public len(): number {
        return this._len;
    }

    public observe(): {
        start(options: SessionOrigin): Promise<string>;
        abort(uuid: string): Promise<void>;
        restart(uuid: string, options: SessionOrigin): Promise<string>;
        list(): Promise<Map<string, ObserveOperation>>;
        operations(): ObserveOperation[];
        isFileSource(): boolean;
        getSourceFileName(): string | undefined;
        descriptions: {
            get(id: number): SourceDefinition | undefined;
            id(uuid: string): number | undefined;
            request(): Promise<SourceDefinition[]>;
            count(): number;
        };
    } {
        return {
            start: (origin: SessionOrigin): Promise<string> => {
                return Requests.IpcRequest.send<Requests.Observe.Start.Response>(
                    Requests.Observe.Start.Response,
                    new Requests.Observe.Start.Request({
                        session: this._uuid,
                        options: origin.getSessionSetup(),
                    }),
                )
                    .then((response) => {
                        if (typeof response.error === 'string' && response.error !== '') {
                            return Promise.reject(new Error(response.error));
                        }
                        if (typeof response.uuid !== 'string' || response.uuid.trim() === '') {
                            return Promise.reject(
                                new Error(`Invalid session start operation UUID`),
                            );
                        }
                        const operationUuid = response.uuid;
                        if (!operationUuid) {
                            return Promise.reject(
                                new Error(
                                    `No operation UUID has been recieved: ${JSON.stringify(
                                        response,
                                    )}`,
                                ),
                            );
                        }
                        const operation = this.operations.get(operationUuid);
                        if (!operation) {
                            return Promise.reject(
                                new Error(
                                    `Operation ${operationUuid} didn't sent Started event: ${JSON.stringify(
                                        response,
                                    )}`,
                                ),
                            );
                        }
                        operation.bind(
                            origin,
                            this.sde.send.bind(this.sde, operationUuid),
                            this.observe().restart.bind(this, operationUuid),
                            this.observe().abort.bind(this, operationUuid),
                        );
                        this.observe()
                            .descriptions.request()
                            .then((sources) => {
                                let updated = false;
                                sources
                                    .filter((source) => source.uuid === operationUuid)
                                    .forEach((source) => {
                                        const added = operation.addSource(source);
                                        updated = updated ? updated : added;
                                    });
                                updated && this.subjects.get().sources.emit();
                            })
                            .catch((err: Error) => {
                                this.log().error(`Fail get sources description: ${err.message}`);
                            });
                        this.sde.overwrite(this.operations);
                        this.subjects.get().started.emit(operation);
                        if (this.operations.size === 1) {
                            // Only if it's the first operation, save as recent
                            recent.add(operation);
                        }
                        if (!this.origin) {
                            this.origin = origin;
                        }
                        return response.session;
                    })
                    .finally(lockers.progress(`Creating session...`));
            },
            abort: (uuid: string): Promise<void> => {
                const operation = this.operations.get(uuid);
                if (!operation) {
                    return Promise.reject(
                        new Error(`Operation ${uuid} doesn't exist. Cannot abort`),
                    );
                }
                if (operation.isStopped()) {
                    return Promise.resolve();
                }
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Observe.Abort.Response,
                        new Requests.Observe.Abort.Request({
                            session: this._uuid,
                            operation: uuid,
                        }),
                    )
                        .then((response: Requests.Observe.Abort.Response) => {
                            if (response.error !== undefined) {
                                return reject(new Error(response.error));
                            }
                            resolve(undefined);
                        })
                        .catch((error: Error) => {
                            this.log().error(
                                `Fail to cancel observe operation sources: ${error.message}`,
                            );
                        });
                });
            },
            restart: (uuid: string, options: SessionOrigin): Promise<string> => {
                const operation = this.operations.get(uuid);
                if (!operation) {
                    return Promise.reject(
                        new Error(`Operation ${uuid} doesn't exist. Cannot restart`),
                    );
                }
                return this.observe()
                    .abort(uuid)
                    .then(() => {
                        return this.observe().start(options);
                    });
            },
            list: (): Promise<Map<string, ObserveOperation>> => {
                return new Promise((resolve) => {
                    Requests.IpcRequest.send(
                        Requests.Observe.List.Response,
                        new Requests.Observe.List.Request({
                            session: this._uuid,
                        }),
                    )
                        .then((response: Requests.Observe.List.Response) => {
                            const operations: Map<string, ObserveOperation> = new Map();
                            response.operations.forEach((uuid: string) => {
                                const operation = this.operations.get(uuid);
                                if (!operation) {
                                    this.log().error(
                                        `Fail to find operation ${uuid} in local scope`,
                                    );
                                } else {
                                    operations.set(uuid, operation);
                                }
                            });
                            resolve(operations);
                        })
                        .catch((error: Error) => {
                            this.log().error(
                                `Fail to get a list of observed sources: ${error.message}`,
                            );
                        });
                });
            },
            operations: (): ObserveOperation[] => {
                return Array.from(this.operations.values());
            },
            isFileSource: (): boolean => {
                const sources = this.observe().operations();
                if (sources.length !== 1) {
                    return false;
                }
                return sources[0].getOrigin().getFirstFilename() !== undefined;
            },
            getSourceFileName: (): string | undefined => {
                const sources = this.observe().operations();
                if (sources.length !== 1) {
                    return undefined;
                }
                return sources[0].getOrigin().getFirstFilename();
            },
            descriptions: {
                get: (id: number): SourceDefinition | undefined => {
                    const operation = Array.from(this.operations.values()).find((operation) => {
                        return operation.getSource(id);
                    });
                    return operation ? operation.getSource(id) : undefined;
                },
                id: (uuid: string): number | undefined => {
                    // TODO:
                    // `uuid` - is an uuid of observe operation, but if it's Files (aka concat)
                    // we would have multiple sources (files) for a one operation
                    const operation = this.operations.get(uuid);
                    return operation ? operation.getFirstSourceKey() : undefined;
                },
                request: (): Promise<SourceDefinition[]> => {
                    return new Promise((resolve, reject) => {
                        Requests.IpcRequest.send(
                            Requests.Observe.SourcesDefinitionsList.Response,
                            new Requests.Observe.SourcesDefinitionsList.Request({
                                session: this._uuid,
                            }),
                        )
                            .then((response: Requests.Observe.SourcesDefinitionsList.Response) => {
                                resolve(response.sources);
                            })
                            .catch(reject);
                    });
                },
                count: (): number => {
                    return Array.from(this.operations.values())
                        .map((operation) => operation.getSourcesCount())
                        .reduce((sum, a) => sum + a, 0);
                },
            },
        };
    }

    public chunk(range: Range): Promise<GrabbedElement[]> {
        if (this._len === 0) {
            // TODO: Grabber is crash session in this case... should be prevented on grabber level
            return Promise.resolve([]);
        }
        return new Promise((resolve) => {
            Requests.IpcRequest.send(
                Requests.Stream.Chunk.Response,
                new Requests.Stream.Chunk.Request({
                    session: this._uuid,
                    from: range.start,
                    to: range.end,
                }),
            )
                .then((response: Requests.Stream.Chunk.Response) => {
                    resolve(response.rows);
                })
                .catch((error: Error) => {
                    this.log().error(`Fail to grab content: ${error.message}`);
                });
        });
    }

    public grab(ranges: IRange[]): Promise<GrabbedElement[]> {
        if (this._len === 0) {
            // TODO: Grabber is crash session in this case... should be prevented on grabber level
            return Promise.resolve([]);
        }
        return new Promise((resolve) => {
            Requests.IpcRequest.send(
                Requests.Stream.Ranges.Response,
                new Requests.Stream.Ranges.Request({
                    session: this._uuid,
                    ranges,
                }),
            )
                .then((response: Requests.Stream.Ranges.Response) => {
                    resolve(response.rows);
                })
                .catch((error: Error) => {
                    this.log().error(`Fail to grab content: ${error.message}`);
                });
        });
    }

    public export(): {
        text(ranges: IRange[], dest?: string, opt?: TextExportOptions): Promise<string | undefined>;
        raw(ranges: IRange[], dest?: string): Promise<string | undefined>;
        isRawAvailable(): Promise<boolean>;
    } {
        return {
            text: (
                ranges: IRange[],
                dest?: string,
                opt?: TextExportOptions,
            ): Promise<string | undefined> => {
                if (this._len === 0) {
                    return Promise.resolve(undefined);
                }
                const options =
                    opt === undefined
                        ? { columns: [], delimiter: undefined, spliter: undefined }
                        : opt;
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Session.Export.Response,
                        new Requests.Session.Export.Request({
                            session: this._uuid,
                            dest,
                            ranges,
                            options,
                        }),
                    )
                        .then((response: Requests.Session.Export.Response) => {
                            if (response.error !== undefined) {
                                return reject(new Error(response.error));
                            }
                            resolve(response.filename);
                        })
                        .catch((error: Error) => {
                            this.log().error(`Fail to export content: ${error.message}`);
                        });
                });
            },
            raw: (ranges: IRange[], dest?: string): Promise<string | undefined> => {
                if (this._len === 0) {
                    return Promise.resolve(undefined);
                }
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Session.ExportRaw.Response,
                        new Requests.Session.ExportRaw.Request({
                            session: this._uuid,
                            dest,
                            ranges,
                        }),
                    )
                        .then((response: Requests.Session.ExportRaw.Response) => {
                            if (response.error !== undefined) {
                                return reject(new Error(response.error));
                            }
                            resolve(response.filename);
                        })
                        .catch((error: Error) => {
                            this.log().error(`Fail to export raw: ${error.message}`);
                        });
                });
            },
            isRawAvailable: (): Promise<boolean> => {
                if (this._len === 0) {
                    return Promise.resolve(false);
                }
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Session.IsExportRawAvailable.Response,
                        new Requests.Session.IsExportRawAvailable.Request({
                            session: this._uuid,
                        }),
                    )
                        .then((response: Requests.Session.IsExportRawAvailable.Response) => {
                            if (response.error !== undefined) {
                                return reject(new Error(response.error));
                            }
                            resolve(response.available);
                        })
                        .catch((error: Error) => {
                            this.log().error(`Fail to check state export raw: ${error.message}`);
                        });
                });
            },
        };
    }
}
export interface Stream extends LoggerInterface {}
