// tslint:disable: member-ordering

import * as Tools from '../../tools/index';

import Logger from '../../tools/env.logger';
import ServiceElectron from '../../services/service.electron';

import { IPCMessages as IPC, Subscription } from '../../services/service.electron';
import { Dependency, DependencyConstructor } from './controller.dependency';
import { Socket } from './controller.dependency.socket';
import { Search } from './controller.dependency.search';
import { Charts } from './controller.dependency.charts';
import { Channel } from './controller.channel';
import {
    Session,
    SessionStream,
    CancelablePromise,
    IFileToBeMerged,
    IExportOptions,
    IDetectDTFormatResult,
    IDetectOptions,
    IExtractOptions,
    IExtractDTFormatResult,
    TFileOptions,
} from 'indexer-neon';

export interface ISubjects {
    destroyed: Tools.Subject<string>;
    inited: Tools.Subject<ControllerSession>;
}

export class ControllerSession {
    private readonly _subscriptions: {
        ipc: { [key: string]: Subscription };
    } = {
        ipc: {},
    };
    private readonly _events: Channel = new Channel();
    private readonly _subjects: ISubjects = {
        destroyed: new Tools.Subject('destroyed'),
        inited: new Tools.Subject('created'),
    };
    private readonly _dependencies: {
        socket: Socket | undefined;
        search: Search | undefined;
        charts: Charts | undefined;
    } = {
        socket: undefined,
        search: undefined,
        charts: undefined,
    };
    private _logger: Logger;
    private _session: Session | undefined;

    constructor() {
        this._logger = new Logger(`ControllerSession (not inited)`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            // Unsubscribe IPC messages / events
            this._ipc().unsubscribe();
            // Kill all dependecies
            Promise.all(
                ([
                    this._dependencies.socket,
                    this._dependencies.search,
                    this._dependencies.charts,
                ].filter((d) => d !== undefined) as Dependency[]).map((dep: Dependency) => {
                    return dep.destroy().catch((err: Error) => {
                        this._logger.warn(`Fail to destroy dependency due err: ${err.message}`);
                        return Promise.resolve();
                    });
                }),
            ).then(() => {
                if (this._session === undefined) {
                    this._logger.warn(
                        `Attempt to destroy session even session wasn't inited at all`,
                    );
                    this._unsubscribe();
                    return resolve();
                }
                const guid: string = this._session.getUUID();
                const session: Session = this._session;
                session
                    .destroy()
                    .catch((err: Error) => {
                        this._logger.error(
                            `Fail to safely destroy session "${guid}" due error: ${err.message}`,
                        );
                    })
                    .finally(() => {
                        this._session = undefined;
                        this._ipc().unsubscribe();
                        resolve();
                        this._subjects.destroyed.emit(guid);
                        this._unsubscribe();
                    });
            });
        });
    }

    public init(): Promise<string> {
        return new Promise((resolve, reject) => {
            // Factory for initialization of dependency
            function getDependency<T>(
                self: ControllerSession,
                sess: Session,
                Dep: DependencyConstructor<T>,
            ): Promise<Dependency & T> {
                return new Promise((res, rej) => {
                    const dependency = new Dep(sess, self._events);
                    self._logger.debug(
                        `Initing ${dependency.getName()} for session ${sess.getUUID()}`,
                    );
                    dependency
                        .init()
                        .then(() => {
                            self._logger.debug(`${dependency.getName()} inited successfully`);
                            res(dependency);
                        })
                        .catch((err: Error) => {
                            rej(
                                new Error(
                                    self._logger.error(
                                        `Fail to init ${dependency.getName()} due error: ${
                                            err.message
                                        }`,
                                    ),
                                ),
                            );
                        });
                });
            }
            // Initialization of session
            let session: Session;
            try {
                session = new Session();
            } catch (err) {
                this._logger.error(`Fail to create a session due error: ${err.message}`);
                this._unsubscribe();
                return reject(err);
            }
            session
                .init()
                .then(() => {
                    this._logger = new Logger(`ControllerSession: ${session.getUUID()}`);
                    this._session = session;
                    // Initialization of dependencies
                    Promise.all([
                        getDependency<Socket>(this, session, Socket).then((dep: Socket) => {
                            this._dependencies.socket = dep;
                        }),
                        getDependency<Search>(this, session, Search).then((dep: Search) => {
                            this._dependencies.search = dep;
                        }),
                        getDependency<Charts>(this, session, Charts).then((dep: Charts) => {
                            this._dependencies.charts = dep;
                        }),
                    ])
                        .then(() => {
                            this._logger.debug(`Session "${session.getUUID()}" is created`);
                            this._ipc().subscribe();
                            resolve(session.getUUID());
                            this._subjects.inited.emit(this);
                        })
                        .catch(reject);
                })
                .catch((err: Error) => {
                    this._logger.error(`Fail to init a session due error: ${err.message}`);
                    this._unsubscribe();
                    reject(err);
                });
        });
    }

    public get(): {
        UUID(): string;
        session(): Session;
    } {
        const session = this._session;
        if (session === undefined) {
            throw new Error(
                this._logger.error(`Cannot return session's UUID because session isn't inited`),
            );
        }
        return {
            UUID(): string {
                return session.getUUID() as string;
            },
            session(): Session {
                return session;
            },
        };
    }

    public getSubjects(): ISubjects {
        return this._subjects;
    }

    public operations(): {
        append(filename: string, options: TFileOptions): CancelablePromise<void>;
        concat(files: string[]): CancelablePromise<void>;
        merge(files: IFileToBeMerged[]): CancelablePromise<void>;
        export(options: IExportOptions): CancelablePromise<void>;
        detectTimeformat(options: IDetectOptions): CancelablePromise<IDetectDTFormatResult>;
        extractTimeformat(options: IExportOptions): CancelablePromise<IExtractDTFormatResult>;
    } {
        const self = this;
        function getStream(): SessionStream {
            const stream = self.get().session().getStream();
            if (stream instanceof Error) {
                throw new Error(`Fail to get stream ref, due error: ${stream.message}`);
            }
            return stream;
        }
        return {
            append(filename: string, options: TFileOptions): CancelablePromise<void> {
                return getStream().append(filename, options);
            },
            concat(files: string[]): CancelablePromise<void> {
                return getStream().concat(files);
            },
            merge(files: IFileToBeMerged[]): CancelablePromise<void> {
                return getStream().merge(files);
            },
            export(options: IExportOptions): CancelablePromise<void> {
                return getStream().export(options);
            },
            detectTimeformat(options: IDetectOptions): CancelablePromise<IDetectDTFormatResult> {
                return getStream().detectTimeformat(options);
            },
            extractTimeformat(options: IExportOptions): CancelablePromise<IExtractDTFormatResult> {
                return getStream().extractTimeformat(options);
            },
        };
    }

    private _ipc(): {
        subscribe(): Promise<void>;
        unsubscribe(): void;
        handlers: {
            reset(
                message: IPC.StreamResetRequest,
                response: (message: IPC.StreamResetResponse) => void,
            ): void;
            concat(
                message: IPC.ConcatFilesRequest,
                response: (message: IPC.ConcatFilesResponse) => void,
            ): void;
            merge(
                request: IPC.MergeFilesRequest,
                response: (instance: IPC.MergeFilesResponse) => any,
            ): void;
            merge_test(
                request: IPC.MergeFilesTestRequest,
                response: (instance: IPC.IMergeFilesDiscoverResult) => any,
            ): void;
            timeformat_discover(
                request: IPC.MergeFilesDiscoverRequest,
                response: (instance: IPC.MergeFilesDiscoverResponse) => any,
            ): void;
            timeformat_request(
                request: IPC.MergeFilesFormatRequest,
                response: (instance: IPC.MergeFilesFormatResponse) => any,
            ): void;
        };
    } {
        const self = this;
        return {
            subscribe(): Promise<void> {
                return Promise.all([
                    ServiceElectron.IPC.subscribe(
                        IPC.ConcatFilesRequest,
                        self._ipc().handlers.concat as any,
                    ).then((subscription: Subscription) => {
                        self._subscriptions.ipc.concate = subscription;
                    }),
                    ServiceElectron.IPC.subscribe(
                        IPC.StreamResetRequest,
                        self._ipc().handlers.reset as any,
                    ).then((subscription: Subscription) => {
                        self._subscriptions.ipc.reset = subscription;
                    }),
                    ServiceElectron.IPC.subscribe(
                        IPC.MergeFilesRequest,
                        self._ipc().handlers.merge as any,
                    ).then((subscription: Subscription) => {
                        self._subscriptions.ipc.merge = subscription;
                    }),
                    ServiceElectron.IPC.subscribe(
                        IPC.MergeFilesTestRequest,
                        self._ipc().handlers.merge_test as any,
                    ).then((subscription: Subscription) => {
                        self._subscriptions.ipc.MergeFilesTestRequest = subscription;
                    }),
                    ServiceElectron.IPC.subscribe(
                        IPC.MergeFilesDiscoverRequest,
                        self._ipc().handlers.timeformat_discover as any,
                    ).then((subscription: Subscription) => {
                        self._subscriptions.ipc.MergeFilesDiscoverRequest = subscription;
                    }),
                    ServiceElectron.IPC.subscribe(
                        IPC.MergeFilesFormatRequest,
                        self._ipc().handlers.timeformat_request as any,
                    ).then((subscription: Subscription) => {
                        self._subscriptions.ipc.MergeFilesFormatRequest = subscription;
                    }),
                ]).then(() => {
                    return Promise.resolve();
                });
            },
            unsubscribe(): void {
                Object.keys(self._subscriptions).forEach((key: string) => {
                    (self._subjects as any)[key].destroy();
                });
            },
            handlers: {
                reset(
                    message: IPC.StreamResetRequest,
                    response: (message: IPC.StreamResetRequest) => void,
                ): void {
                    if (message.guid !== self.get().UUID()) {
                        return;
                    }
                    self.get()
                        .session()
                        .reset()
                        .then(() => {
                            self._logger.debug(`Session "${message.guid}" was reset.`);
                            response(
                                new IPC.StreamResetResponse({
                                    guid: message.guid,
                                }),
                            );
                        })
                        .catch((err: Error) => {
                            response(
                                new IPC.StreamResetResponse({
                                    guid: message.guid,
                                    error: self._logger.warn(
                                        `Fail to reset session "${message.guid}" due error: ${err.message}.`,
                                    ),
                                }),
                            );
                        });
                },
                concat(
                    message: IPC.ConcatFilesRequest,
                    response: (message: IPC.ConcatFilesResponse) => void,
                ): void {
                    if (message.session !== self.get().UUID()) {
                        return;
                    }
                    self.operations()
                        .concat(message.files)
                        .then(() => {
                            response(
                                new IPC.ConcatFilesResponse({
                                    id: message.id,
                                }),
                            );
                        })
                        .catch((err: Error) => {
                            response(
                                new IPC.ConcatFilesResponse({
                                    id: message.id,
                                    error: self._logger.warn(
                                        `Fail to concat files due error: ${err.message}`,
                                    ),
                                }),
                            );
                        });
                },
                merge(
                    message: IPC.MergeFilesRequest,
                    response: (instance: IPC.MergeFilesResponse) => any,
                ): void {
                    if (message.session !== self.get().UUID()) {
                        return;
                    }
                    self.operations()
                        .merge([])
                        .then(() => {
                            response(
                                new IPC.MergeFilesResponse({
                                    id: message.id,
                                }),
                            );
                        })
                        .catch((err: Error) => {
                            response(
                                new IPC.MergeFilesResponse({
                                    id: message.id,
                                    error: self._logger.warn(
                                        `Fail to concat files due error: ${err.message}`,
                                    ),
                                }),
                            );
                        });
                },
                merge_test(
                    message: IPC.MergeFilesTestRequest,
                    response: (instance: IPC.IMergeFilesDiscoverResult) => any,
                ): void {
                    //TODO: Implement
                },
                timeformat_discover(
                    message: IPC.MergeFilesDiscoverRequest,
                    response: (instance: IPC.MergeFilesDiscoverResponse) => any,
                ): void {
                    //TODO: Implement
                },
                timeformat_request(
                    message: IPC.MergeFilesFormatRequest,
                    response: (instance: IPC.MergeFilesFormatResponse) => any,
                ): void {
                    //TODO: Implement
                }
            },
        };
    }

    private _unsubscribe() {
        Object.keys(this._subjects).forEach((key: string) => {
            (this._subjects as any)[key].destroy();
        });
    }
}
