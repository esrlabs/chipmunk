// tslint:disable: member-ordering
import * as Tools from '../../tools/index';

import ServiceElectron from '../../services/service.electron';
import Logger from '../../tools/env.logger';

import { IPCMessages as IPC, Subscription } from '../../services/service.electron';
import { Session, SessionSearch, Events, IEventMapUpdated } from 'rustcore';
import { Postman } from '../../tools/postman';
import { Dependency } from './controller.dependency';
import { Channel } from './controller.channel';
import { CommonInterfaces } from '../../interfaces/interface.common';

export interface IRange {
    from: number;
    to: number;
}

export interface IRangeMapItem {
    rows: IRange;
    bytes: IRange;
}

export class Search extends Dependency {
    private readonly _logger: Logger;
    private readonly _subscriptions: {
        session: { [key: string]: Events.Subscription };
        ipc: { [key: string]: Subscription };
    } = {
        session: {},
        ipc: {},
    };
    private readonly _session: Session;
    private readonly _channel: Channel;
    private readonly _postman: Postman<IPC.SearchUpdated>;
    private _filters: CommonInterfaces.API.IFilter[] = [];

    constructor(session: Session, channel: Channel) {
        super();
        this._logger = new Logger(`Search: ${session.getUUID()}`);
        this._session = session;
        this._channel = channel;
        this._postman = new Postman<IPC.SearchUpdated>(session.getUUID(), 250, () => {
            const search = session.getSearch();
            if (search instanceof Error) {
                return search;
            }
            const stream = session.getStream();
            if (stream instanceof Error) {
                return stream;
            }
            return new IPC.SearchUpdated({
                guid: this._session.getUUID(),
                matches: search.len(),
                rows: stream.len(),
            });
        });
    }

    public getName(): string {
        return 'Search';
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Unsubscribe IPC messages / events
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            resolve();
        });
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const error: Error | undefined = this._events().subscribe();
            if (error instanceof Error) {
                return reject(error);
            }
            this._ipc().subscribe().then(resolve).catch(reject);
        });
    }

    private _events(): {
        subscribe(): Error | undefined;
        unsubscribe(): void;
        handlers: {
            search(rows: number): void;
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
                self._subscriptions.session.search = events.SearchUpdated.subscribe(
                    self._events().handlers.search,
                );
                self._subscriptions.session.map = events.MapUpdated.subscribe(
                    self._events().handlers.map,
                );
            },
            unsubscribe(): void {
                Object.keys(self._subscriptions.session).forEach((key: string) => {
                    self._subscriptions.session[key].destroy();
                });
            },
            handlers: {
                search(rows: number): void {
                    self._postman.notify();
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
            search(
                msg: IPC.SearchRequest,
                response: (instance: IPC.SearchRequestResults) => any,
            ): void;
            map(
                msg: IPC.SearchResultMapRequest,
                response: (instance: IPC.SearchResultMapResponse) => any,
            ): void;
            nearest(
                msg: IPC.SearchResultNearestRequest,
                response: (instance: IPC.SearchResultNearestResponse) => any,
            ): void;
            chunk(msg: IPC.SearchChunk, response: (isntance: IPC.SearchChunk) => any): void;
        };
    } {
        const self = this;
        return {
            subscribe(): Promise<void> {
                return Promise.all([
                    ServiceElectron.IPC.subscribe(
                        IPC.SearchRequest,
                        self._ipc().handlers.search as any,
                    )
                        .then((subscription: Subscription) => {
                            self._subscriptions.ipc.search = subscription;
                        })
                        .catch((error: Error) => {
                            return Promise.reject(
                                new Error(
                                    self._logger.warn(
                                        `Fail to subscribe to render event "SearchRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`,
                                    ),
                                ),
                            );
                        }),
                    ServiceElectron.IPC.subscribe(
                        IPC.SearchResultMapRequest,
                        self._ipc().handlers.map as any,
                    )
                        .then((subscription: Subscription) => {
                            self._subscriptions.ipc.map = subscription;
                        })
                        .catch((error: Error) => {
                            return Promise.reject(
                                new Error(
                                    self._logger.warn(
                                        `Fail to subscribe to render event "SearchRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`,
                                    ),
                                ),
                            );
                        }),
                    ServiceElectron.IPC.subscribe(
                        IPC.SearchChunk,
                        self._ipc().handlers.chunk as any,
                    )
                        .then((subscription: Subscription) => {
                            self._subscriptions.ipc.chunk = subscription;
                        })
                        .catch((error: Error) => {
                            return Promise.reject(
                                new Error(
                                    self._logger.warn(
                                        `Fail to subscribe to render event "SearchChunk" due error: ${error.message}. This is not blocked error, loading will be continued.`,
                                    ),
                                ),
                            );
                        }),
                    ServiceElectron.IPC.subscribe(
                        IPC.SearchResultNearestRequest,
                        self._ipc().handlers.nearest as any,
                    )
                        .then((subscription: Subscription) => {
                            self._subscriptions.ipc.chunk = subscription;
                        })
                        .catch((error: Error) => {
                            return Promise.reject(
                                new Error(
                                    self._logger.warn(
                                        `Fail to subscribe to render event "SearchResultNearestRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`,
                                    ),
                                ),
                            );
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
                search(
                    msg: IPC.SearchRequest,
                    response: (instance: IPC.SearchRequestResults) => any,
                ): void {
                    const search = self._session.getSearch();
                    if (search instanceof Error) {
                        self._logger.warn(
                            `Fail get access to search controller due error: ${search.message}`,
                        );
                        return;
                    }
                    const filters: CommonInterfaces.API.IFilter[] = msg.requests.map((f) => {
                        return {
                            filter: f.request,
                            flags: {
                                word: f.flags.wholeword,
                                cases: f.flags.casesensitive,
                                reg: f.flags.regexp,
                            },
                        };
                    });
                    search
                        .search(filters)
                        .then((result) => {
                            self._filters = filters;
                            self._channel
                                .getEvents()
                                .afterFiltersListUpdated.emit(
                                    self._filters.map((f) => Object.assign({}, f)),
                                );
                            response(
                                new IPC.SearchRequestResults({
                                    streamId: msg.session,
                                    requestId: msg.id,
                                    found: result.found,
                                    stats: result.stats,
                                    duration: 0,
                                }),
                            );
                        })
                        .catch((err: Error) => {
                            self._logger.warn(`Fail to search due error: ${err.message}`);
                            response(
                                new IPC.SearchRequestResults({
                                    streamId: msg.session,
                                    error: err.message,
                                    requestId: msg.id,
                                    found: 0,
                                    stats: [],
                                    duration: 0,
                                }),
                            );
                        });
                },
                map(
                    msg: IPC.SearchResultMapRequest,
                    response: (instance: IPC.SearchResultMapResponse) => any,
                ): void {
                    const search = self._session.getSearch();
                    if (search instanceof Error) {
                        return response(
                            new IPC.SearchResultMapResponse({
                                streamId: msg.streamId,
                                map: [],
                                error: self._logger.warn(
                                    `Fail get access to search controller due error: ${search.message}`,
                                ),
                            }),
                        );
                    }
                    search
                        .getMap(
                            msg.scale,
                            msg.range !== undefined ? msg.range.begin : undefined,
                            msg.range !== undefined ? msg.range.end : undefined,
                        )
                        .then((map: CommonInterfaces.API.ISearchMap) => {
                            response(
                                new IPC.SearchResultMapResponse({
                                    streamId: msg.streamId,
                                    map: map,
                                }),
                            );
                        })
                        .catch((err: Error) => {
                            response(
                                new IPC.SearchResultMapResponse({
                                    streamId: msg.streamId,
                                    map: [],
                                    error: self._logger.warn(
                                        `Fail get a search map. Error: ${err.message}`,
                                    ),
                                }),
                            );
                        });
                },
                nearest(
                    msg: IPC.SearchResultNearestRequest,
                    response: (instance: IPC.SearchResultNearestResponse) => any,
                ): void {
                    const search = self._session.getSearch();
                    if (search instanceof Error) {
                        return response(
                            new IPC.SearchResultNearestResponse({
                                streamId: msg.streamId,
                                positionInSearch: -1,
                                positionInStream: -1,
                                error: self._logger.warn(
                                    `Fail get access to search controller due error: ${search.message}`,
                                ),
                            }),
                        );
                    }
                    const nearst = search.getNearest(msg.positionInStream);
                    if (nearst === undefined) {
                        response(
                            new IPC.SearchResultNearestResponse({
                                streamId: msg.streamId,
                                positionInSearch: -1,
                                positionInStream: -1,
                            }),
                        );
                    } else {
                        response(
                            new IPC.SearchResultNearestResponse({
                                streamId: msg.streamId,
                                positionInSearch: nearst.index,
                                positionInStream: nearst.position,
                            }),
                        );
                    }
                },
                chunk(msg: IPC.SearchChunk, response: (isntance: IPC.SearchChunk) => any): void {
                    if (msg.guid !== self._session.getUUID()) {
                        return;
                    }
                    const search = self._session.getSearch();
                    if (search instanceof Error) {
                        return response(
                            new IPC.SearchChunk({
                                error: self._logger.warn(
                                    `Fail to access session controller due error: ${search.message}`,
                                ),
                                start: msg.start,
                                end: msg.end,
                                guid: msg.guid,
                            }),
                        );
                    }
                    const rows = search.grab(msg.start, msg.end - msg.start);
                    if (!(rows instanceof Array)) {
                        return response(
                            new IPC.SearchChunk({
                                error: self._logger.warn(
                                    `Fail to get requested rows due error: ${rows.message}`,
                                ),
                                start: msg.start,
                                end: msg.end,
                                guid: msg.guid,
                            }),
                        );
                    }
                    response(
                        new IPC.SearchChunk({
                            start: msg.start,
                            end: msg.end,
                            guid: msg.guid,
                            data: JSON.stringify(rows),
                            rows: search.len(),
                        }),
                    );
                },
            },
        };
    }
}
