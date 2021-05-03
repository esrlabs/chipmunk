// tslint:disable: member-ordering
import * as Tools from '../../tools/index';

import ServiceElectron from '../../services/service.electron';
import Logger from '../../tools/env.logger';

import { IPCMessages as IPC, Subscription } from '../../services/service.electron';
import {
    Session,
    TFileOptions,
    EFileOptionsRequirements,
    PromiseExecutor,
    SessionStream,
    Events,
    IEventMatchesUpdated,
    IEventMapUpdated,
} from 'indexer-neon';
import { Dependency } from './controller.dependency';
import { Channel, IProgressState } from './controller.channel';
import { getExtendFilesInfo, getExtendFileInfo } from '../../tools/fs';

export class Files extends Dependency {
    private readonly _logger: Logger;
    private readonly _subscriptions: {
        session: { [key: string]: Events.Subscription };
        ipc: { [key: string]: Subscription };
        channel: { [key: string]: Subscription };
    } = {
        session: {},
        ipc: {},
        channel: {},
    };
    private readonly _session: Session;
    private readonly _stream: SessionStream;
    private readonly _sessionChannel: Channel;
    private readonly _tasts: {
        append: PromiseExecutor<void>;
    } = {
        append: new PromiseExecutor<void>(),
    };

    constructor(session: Session, channel: Channel) {
        super();
        this._logger = new Logger(`Files: ${session.getUUID()}`);
        this._session = session;
        this._sessionChannel = channel;
        const stream: SessionStream | Error = session.getStream();
        if (stream instanceof Error) {
            this._logger.error(`Fail to get stream controller due error: ${stream.message}`);
            throw stream;
        }
        this._stream = stream;
    }

    public getName(): string {
        return 'Files';
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._events().unsubscribe();
            this._channel().unsubscribe();
            this._ipc().unsubscribe();
            resolve();
        });
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const error: Error | undefined = this._events().subscribe();
            if (error instanceof Error) {
                return reject(error);
            }
            this._ipc()
                .subscribe()
                .then(() => {
                    this._channel().subscribe();
                    resolve();
                })
                .catch(reject);
        });
    }

    public open(filename: string, options: TFileOptions): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this._tasts.append.run(() => {
                const progress = this._sessionChannel.addProgressiveTask();
                return this._stream
                    .assign(filename, options)
                    .on('progress', (event: IProgressState) => {
                        progress.progress(event);
                    })
                    .catch((err: Error) => {
                        this._logger.warn(
                            `Fail append file "${filename}" due error: ${err.message}`,
                        );
                        reject(err);
                    })
                    .canceled(() => {
                        this._logger.debug(`Appending file "${filename}" is canceled`);
                        resolve(true);
                    })
                    .then(() => {
                        this._logger.debug(`Appending file "${filename}" is done`);
                        resolve(false);
                    })
                    .finally(() => {
                        progress.done();
                    });
            });
        });
    }

    public getFileOptionsRequirements(filename: string): EFileOptionsRequirements {
        return this._stream.getFileOptionsRequirements(filename);
    }

    private _events(): {
        subscribe(): Error | undefined;
        unsubscribe(): void;
        handlers: {
            matches(event: IEventMatchesUpdated): void;
            map(event: IEventMapUpdated): void;
        };
    } {
        const self = this;
        return {
            subscribe(): Error | undefined {
                const events = self._session.getEvents();
                if (events instanceof Error) {
                    return new Error(
                        self._logger.error(
                            `Fail to subscribe on session events due error: ${events}`,
                        ),
                    );
                }
                self._subscriptions.session.matches = events.MatchesUpdated.subscribe(
                    self._events().handlers.matches,
                );
                self._subscriptions.session.map = events.MapUpdated.subscribe(self._events().handlers.map);
            },
            unsubscribe(): void {
                Object.keys(self._subscriptions.session).forEach((key: string) => {
                    self._subscriptions.session[key].destroy();
                });
            },
            handlers: {
                matches(event: IEventMatchesUpdated): void {
                    //
                },
                map(event: IEventMapUpdated): void {
                    //
                },
            },
        };
    }

    private _ipc(): {
        subscribe(): Promise<void>;
        unsubscribe(): void;
        handlers: {
            open(
                request: IPC.FileOpenRequest,
                response: (instance: IPC.FileOpenResponse) => any,
            ): void;
            list(
                request: IPC.FileListRequest,
                response: (instance: IPC.FileListResponse) => any,
            ): void;
            options(
                request: IPC.FileGetOptionsRequest,
                response: (instance: IPC.FileGetOptionsResponse) => any,
            ): void;
            info(
                request: IPC.FileInfoRequest,
                response: (instance: IPC.FileInfoResponse) => any,
            ): void;
        };
    } {
        const self = this;
        return {
            subscribe(): Promise<void> {
                return Promise.all([
                    ServiceElectron.IPC.subscribe(
                        IPC.FileOpenRequest,
                        self._ipc().handlers.open as any,
                    ).then((subscription: Subscription) => {
                        self._subscriptions.ipc.FileOpenRequest = subscription;
                    }),
                    ServiceElectron.IPC.subscribe(
                        IPC.FileListRequest,
                        self._ipc().handlers.list as any,
                    ).then((subscription: Subscription) => {
                        self._subscriptions.ipc.FileListRequest = subscription;
                    }),
                    ServiceElectron.IPC.subscribe(
                        IPC.FileGetOptionsRequest,
                        self._ipc().handlers.options as any,
                    ).then((subscription: Subscription) => {
                        self._subscriptions.ipc.FileGetOptionsRequest = subscription;
                    }),
                    ServiceElectron.IPC.subscribe(
                        IPC.FileInfoRequest,
                        self._ipc().handlers.info as any,
                    ).then((subscription: Subscription) => {
                        self._subscriptions.ipc.FileGetParserRequest = subscription;
                    }),
                ]).then(() => {
                    return Promise.resolve();
                });
            },
            unsubscribe(): void {
                Object.keys(self._subscriptions.ipc).forEach((key: string) => {
                    self._subscriptions.ipc[key].destroy();
                });
            },
            handlers: {
                open(
                    request: IPC.FileOpenRequest,
                    response: (instance: IPC.FileOpenResponse) => any,
                ): void {
                    if (request.session !== self._session.getUUID()) {
                        return;
                    }
                    self.open(request.file, request.options)
                        .then((canceled: boolean) => {
                            response(
                                new IPC.FileOpenResponse({
                                    canceled: canceled,
                                }),
                            );
                        })
                        .catch((err: Error) => {
                            self._logger.error(
                                `Unexpected error during appending file "${request.file}": ${err.message}`,
                            );
                            self._logger.error(err.stack);
                            response(
                                new IPC.FileOpenResponse({
                                    error: err.message,
                                }),
                            );
                        });
                },
                list(
                    request: IPC.FileListRequest,
                    response: (instance: IPC.FileListResponse) => any,
                ): void {
                    if (request.session !== self._session.getUUID()) {
                        return;
                    }
                    getExtendFilesInfo(request.files)
                        .then((info) => {
                            response(
                                new IPC.FileListResponse({
                                    files: info.files,
                                }),
                            );
                        })
                        .catch((err: Error) => {
                            response(
                                new IPC.FileListResponse({
                                    files: [],
                                    error: err.message,
                                }),
                            );
                        });
                },
                options(
                    request: IPC.FileGetOptionsRequest,
                    response: (instance: IPC.FileGetOptionsResponse) => any,
                ): void {
                    if (request.session !== self._session.getUUID()) {
                        return;
                    }
                    response(
                        new IPC.FileGetOptionsResponse({
                            options: self._stream.getFileOptionsRequirements(request.filename),
                        }),
                    );
                },
                info(
                    request: IPC.FileInfoRequest,
                    response: (instance: IPC.FileInfoResponse) => any,
                ): void {
                    getExtendFileInfo(request.file).then((info) => {
                        response(
                            new IPC.FileInfoResponse({
                                info: info,
                            }),
                        );
                    }).catch((err: Error) => {
                        response(
                            new IPC.FileInfoResponse({
                                error: err.message,
                            }),
                        );
                    });
                }
            },
        };
    }

    private _channel(): {
        subscribe(): void;
        unsubscribe(): void;
        handlers: {};
    } {
        const self = this;
        return {
            subscribe(): void {
                //
            },
            unsubscribe(): void {
                //
            },
            handlers: {},
        };
    }
}
