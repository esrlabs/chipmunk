import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { Range, IRange } from '@platform/types/range';
import { cutUuid } from '@log/index';
import { Rank } from './rank';
import { GrabbedElement } from '@platform/types/bindings/miscellaneous';
import { Observe } from '@platform/types/observe';
import { ObserveOperation } from './observing/operation';
import { ObserveSource } from './observing/source';
import { Info } from './info';
import { lockers } from '@ui/service/lockers';
import { Sde } from './observing/sde';
import { TextExportOptions } from '@platform/types/exporting';
import { SessionSetup, SessionDescriptor } from '@platform/types/bindings';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';
import * as $ from '@platform/types/observe';

export { ObserveOperation };

@SetupLogger()
export class Stream extends Subscriber {
    public readonly subjects: Subjects<{
        // Stream is updated (new rows came)
        updated: Subject<number>;
        // New observe operation is started
        started: Subject<Observe>;
        // Observe operation for source is finished
        finished: Subject<Observe>;
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
        started: new Subject<Observe>(),
        finished: new Subject<Observe>(),
        sources: new Subject<void>(),
        rank: new Subject<number>(),
        readable: new Subject<void>(),
        descriptor: new Subject<SessionDescriptor>(),
    });
    private _len: number = 0;
    private _uuid!: string;
    private _info!: Info;

    public readonly observed: {
        running: Map<string, ObserveOperation>;
        done: Map<string, Observe>;
        map: Map<number, $.Types.ISourceLink>;
    } = {
        running: new Map(),
        done: new Map(),
        map: new Map(),
    };
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
            }),
            Events.IpcEvent.subscribe(Events.Observe.Started.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                console.error(`Not implemented`);
                // const observe = Observe.from(event.source);
                // if (observe instanceof Error) {
                //     this.log().error(`Fail to parse Observe: ${observe.message}`);
                //     return;
                // }
                // this.observed.running.set(
                //     event.operation,
                //     new ObserveOperation(
                //         event.operation,
                //         observe,
                //         this.sde.send.bind(this.sde, event.operation),
                //         this.observe().restart.bind(this, event.operation),
                //         this.observe().abort.bind(this, event.operation),
                //     ),
                // );
                // this.observe()
                //     .descriptions.request()
                //     .then((sources) => {
                //         let updated = false;
                //         sources.forEach((source) => {
                //             if (!this.observed.map.has(source.id)) {
                //                 this.observed.map.set(source.id, source);
                //                 updated = true;
                //             }
                //         });
                //         updated && this.subjects.get().sources.emit();
                //     })
                //     .catch((err: Error) => {
                //         this.log().error(`Fail get sources description: ${err.message}`);
                //     });
                // this.sde.overwrite(this.observed.running);
                let observe = Observe.new();
                this.subjects.get().started.emit(observe);
            }),
        );
        this.register(
            Events.IpcEvent.subscribe(Events.Observe.Finished.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                const stored = this.observed.running.get(event.operation);
                if (stored === undefined) {
                    return;
                }
                this.observed.done.set(event.operation, stored.asObserve());
                this.observed.running.delete(event.operation);
                this.sde.overwrite(this.observed.running);
                this.subjects.get().finished.emit(stored.asObserve());
            }),
        );
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
        this.sde.destroy();
    }

    public len(): number {
        return this._len;
    }

    public observe(): {
        start(options: SessionSetup): Promise<string>;
        abort(uuid: string): Promise<void>;
        restart(uuid: string, options: SessionSetup): Promise<string>;
        list(): Promise<Map<string, Observe>>;
        sources(): ObserveSource[];
        isFileSource(): boolean;
        getSourceFileName(): string | undefined;
        descriptions: {
            get(id: number): $.Types.ISourceLink | undefined;
            id(alias: string): number | undefined;
            request(): Promise<$.Types.ISourceLink[]>;
            count(): number;
        };
    } {
        return {
            start: (options: SessionSetup): Promise<string> => {
                return Requests.IpcRequest.send<Requests.Observe.Start.Response>(
                    Requests.Observe.Start.Response,
                    new Requests.Observe.Start.Request({
                        session: this._uuid,
                        options,
                    }),
                )
                    .then((response) => {
                        if (typeof response.error === 'string' && response.error !== '') {
                            return Promise.reject(new Error(response.error));
                        }
                        // this._info.fromObserveInfo(observe);
                        return response.session;
                    })
                    .finally(lockers.progress(`Creating session...`));
            },
            abort: (uuid: string): Promise<void> => {
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
            restart: (uuid: string, options: SessionSetup): Promise<string> => {
                return this.observe()
                    .abort(uuid)
                    .then(() => {
                        return this.observe().start(options);
                    });
            },
            list: (): Promise<Map<string, Observe>> => {
                return new Promise((resolve) => {
                    Requests.IpcRequest.send(
                        Requests.Observe.List.Response,
                        new Requests.Observe.List.Request({
                            session: this._uuid,
                        }),
                    )
                        .then((response: Requests.Observe.List.Response) => {
                            const sources: Map<string, Observe> = new Map();
                            Object.keys(response.sources).forEach((uuid: string) => {
                                const source = Observe.from(response.sources[uuid]);
                                if (source instanceof Error) {
                                    this.log().error(`Fail to parse Observe: ${source.message}`);
                                    return;
                                }
                                sources.set(uuid, source);
                            });
                            resolve(sources);
                        })
                        .catch((error: Error) => {
                            this.log().error(
                                `Fail to get a list of observed sources: ${error.message}`,
                            );
                        });
                });
            },
            sources: (): ObserveSource[] => {
                const sources: ObserveSource[] = [];
                Array.from(this.observed.running.values()).forEach((observed: ObserveOperation) => {
                    sources.push(new ObserveSource(observed.asObserve(), observed));
                });
                Array.from(this.observed.done.values()).forEach((source: Observe) => {
                    sources.push(new ObserveSource(source));
                });
                return sources;
            },
            isFileSource: (): boolean => {
                const sources = this.observe().sources();
                if (sources.length !== 1) {
                    return false;
                }
                return sources[0].observe.origin.files() !== undefined;
            },
            getSourceFileName: (): string | undefined => {
                const sources = this.observe().sources();
                if (sources.length !== 1) {
                    return undefined;
                }
                const files = sources[0].observe.origin.files();
                if (files === undefined || (files instanceof Array && files.length === 0)) {
                    return undefined;
                }
                return files instanceof Array ? files[0] : files;
            },
            descriptions: {
                get: (id: number): $.Types.ISourceLink | undefined => {
                    return this.observed.map.get(id);
                },
                id: (alias: string): number | undefined => {
                    const link = Array.from(this.observed.map.values()).find(
                        (s) => s.alias === alias,
                    );
                    return link !== undefined ? link.id : undefined;
                },
                request: (): Promise<$.Types.ISourceLink[]> => {
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
                    return this.observed.map.size;
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
