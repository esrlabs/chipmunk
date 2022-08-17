import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { Range } from '@platform/types/range';
import { cutUuid } from '@log/index';
import { Rank } from './rank';
import { IGrabbedElement } from '@platform/types/content';
import { DataSource } from '@platform/types/observe';
import { ObserveOperation } from './observe/operation';
import { error } from '@platform/env/logger';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

export { ObserveOperation, DataSource };

@SetupLogger()
export class Stream extends Subscriber {
    public readonly subjects: Subjects<{
        updated: Subject<number>;
        observe: Subject<Map<string, ObserveOperation>>;
        rank: Subject<number>;
    }> = new Subjects({
        updated: new Subject<number>(),
        observe: new Subject<Map<string, ObserveOperation>>(),
        rank: new Subject<number>(),
    });
    private _len: number = 0;
    private _uuid!: string;

    public readonly observed: {
        running: Map<string, ObserveOperation>;
        done: Map<string, DataSource>;
    } = {
        running: new Map(),
        done: new Map(),
    };
    public readonly rank: Rank = new Rank();

    public init(uuid: string) {
        this.setLoggerName(`Stream: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this.register(
            Events.IpcEvent.subscribe(Events.Stream.Updated.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                this._len = event.rows;
                this.subjects.get().updated.emit(this._len);
                if (this.rank.set(this._len.toString().length)) {
                    this.subjects.get().rank.emit(this.rank.len);
                }
            }),
        );
        this.register(
            Events.IpcEvent.subscribe(Events.Observe.Started.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                const source = DataSource.from(event.source);
                if (source instanceof Error) {
                    this.log().error(`Fail to parse DataSource: ${source.message}`);
                    return;
                }
                this.observed.running.set(
                    event.operation,
                    new ObserveOperation(
                        event.operation,
                        source,
                        this.observe().sde,
                        this.observe().abort,
                    ),
                );
                this.subjects.get().observe.emit(this.observed.running);
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
                this.observed.done.set(event.operation, stored.asSource());
                this.observed.running.delete(event.operation);
                this.subjects.get().observe.emit(this.observed.running);
            }),
        );
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
    }

    public len(): number {
        return this._len;
    }

    public observe(): {
        abort(uuid: string): Promise<void>;
        list(): Promise<Map<string, DataSource>>;
        sde<T, R>(uuid: string, msg: T): Promise<R>;
    } {
        return {
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
            list: (): Promise<Map<string, DataSource>> => {
                return new Promise((resolve) => {
                    Requests.IpcRequest.send(
                        Requests.Observe.List.Response,
                        new Requests.Observe.List.Request({
                            session: this._uuid,
                        }),
                    )
                        .then((response: Requests.Observe.List.Response) => {
                            const sources: Map<string, DataSource> = new Map();
                            Object.keys(response.sources).forEach((uuid: string) => {
                                const source = DataSource.from(response.sources[uuid]);
                                if (source instanceof Error) {
                                    this.log().error(`Fail to parse DataSource: ${source.message}`);
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
            sde: <T, R>(uuid: string, msg: T): Promise<R> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Observe.SDE.Response,
                        new Requests.Observe.SDE.Request({
                            session: this._uuid,
                            operation: uuid,
                            json: JSON.stringify(msg),
                        }),
                    )
                        .then((response: Requests.Observe.SDE.Response) => {
                            if (response.error !== undefined) {
                                return reject(new Error(response.error));
                            }
                            if (response.result === undefined) {
                                return reject(new Error(`SDE doesn't return any kind of result`));
                            }
                            try {
                                resolve(JSON.parse(response.result) as unknown as R);
                            } catch (e) {
                                return reject(new Error(error(e)));
                            }
                        })
                        .catch((error: Error) => {
                            this.log().error(`Fail to send SDE into operation: ${error.message}`);
                        });
                });
            },
        };
    }

    public chunk(range: Range): Promise<IGrabbedElement[]> {
        if (this._len === 0) {
            // TODO: Grabber is crash session in this case... should be prevented on grabber level
            return Promise.resolve([]);
        }
        return new Promise((resolve) => {
            Requests.IpcRequest.send(
                Requests.Stream.Chunk.Response,
                new Requests.Stream.Chunk.Request({
                    session: this._uuid,
                    from: range.from,
                    to: range.to,
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
}
export interface Stream extends LoggerInterface {}
