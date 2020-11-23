// tslint:disable: member-ordering
import * as Tools from '../../tools/index';

import ServiceElectron from '../../services/service.electron';
import Logger from '../../tools/env.logger';

import { IPCMessages as IPC, Subscription } from '../../services/service.electron';
import {
    Session,
    SessionSearch,
    Events,
    IEventMatchesUpdated,
    IEventMapUpdated,
} from 'indexer-neon';
import { Dependency } from './controller.dependency';
import { Channel } from './controller.channel';
import { CommonInterfaces } from '../../interfaces/interface.common';

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
    private readonly _search: SessionSearch;
    private readonly _sessionChannel: Channel;
    private _charts: CommonInterfaces.API.IFilter[] = [];
    private _filters: CommonInterfaces.API.IFilter[] = [];

    constructor(session: Session, channel: Channel) {
        super();
        this._logger = new Logger(`Files: ${session.getUUID()}`);
        this._session = session;
        this._sessionChannel = channel;
        const search: SessionSearch | Error = session.getSearch();
        if (search instanceof Error) {
            this._logger.error(`Fail to get search controller due error: ${search.message}`);
            throw search;
        }
        this._search = search;
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
                self._subscriptions.session.matches = events.matches.subscribe(
                    self._events().handlers.matches,
                );
                self._subscriptions.session.map = events.map.subscribe(self._events().handlers.map);
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
        };
    } {
        const self = this;
        return {
            subscribe(): Promise<void> {
                return Promise.all([
                    ServiceElectron.IPC.subscribe(
                        IPC.FileOpenRequest,
                        self._ipc().handlers.open,
                    ).then((subscription: Subscription) => {
                        this._subscriptions.FileOpenRequest = subscription;
                    }),
                    ServiceElectron.IPC.subscribe(
                        IPC.FileListRequest,
                        self._ipc().handlers.list,
                    ).then((subscription: Subscription) => {
                        this._subscriptions.FileListRequest = subscription;
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
                    self.open(request.file, request.session, undefined, request.options)
                        .then((result: IOpenFileResult) => {
                            const info = ServiceStreamSource.get(result.sourceId);
                            if (info !== undefined) {
                                (info as IPC.IStreamSourceNew).id = result.sourceId;
                            }
                            response(
                                new IPC.FileOpenResponse({
                                    stream: info as IPC.IStreamSourceNew,
                                    options: result.options,
                                }),
                            );
                        })
                        .catch((openError: Error) => {
                            response(
                                new IPC.FileOpenResponse({
                                    error: openError.message,
                                    stream: undefined,
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
                    Promise.all(
                        request.files.map((file: string) => {
                            return this._listFiles(file);
                        }),
                    )
                        .then((fileLists: IPC.IFile[][]) => {
                            response(
                                new IPC.FileListResponse({
                                    files: this._concatFileList(fileLists),
                                }),
                            ).catch((error: Error) => {
                                this._logger.error(
                                    `Fail to respond to files ${request.files} due error: ${error.message}`,
                                );
                            });
                        })
                        .catch((error: Error) => {
                            response(
                                new IPC.FileListResponse({
                                    files: [],
                                    error: error.message,
                                }),
                            );
                        });
                },
            },
        };
    }

    private _channel(): {
        subscribe(): void;
        unsubscribe(): void;
        handlers: {
            filters(filters: CommonInterfaces.API.IFilter[]): void;
        };
    } {
        const self = this;
        return {
            subscribe(): void {
                self._subscriptions.channel.filters = self._sessionChannel
                    .getEvents()
                    .afterFiltersListUpdated.subscribe(self._channel().handlers.filters);
            },
            unsubscribe(): void {
                Object.keys(self._subscriptions.session).forEach((key: string) => {
                    self._subscriptions.channel[key].destroy();
                });
            },
            handlers: {
                filters(filters: CommonInterfaces.API.IFilter[]): void {
                    self._filters = filters;
                },
            },
        };
    }
}
