// tslint:disable: member-ordering
import * as Tools from '../../tools/index';

import ServiceElectron from '../../services/service.electron';
import Logger from '../../tools/env.logger';

import { IPCMessages as IPC, Subscription } from '../../services/service.electron';
import {
    Session,
    SessionSearch,
    Events,
    IEventMapUpdated,
} from 'rustcore';
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
    private readonly _search: SessionSearch;
    private readonly _channel: Channel;
    private _filters: CommonInterfaces.API.IFilter[] = [];

    constructor(session: Session, channel: Channel) {
        super();
        this._logger = new Logger(`Search: ${session.getUUID()}`);
        this._session = session;
        this._channel = channel;
        const search: SessionSearch | Error = session.getSearch();
        if (search instanceof Error) {
            this._logger.error(`Fail to get search controller due error: ${search.message}`);
            throw search;
        }
        this._search = search;
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

    public setFilters(filters: CommonInterfaces.API.IFilter[]): Error | undefined {
        const error: Error | undefined = this._search.setFilters(filters);
        if (error instanceof Error) {
            this._logger.warn(`Fail to set filters for search due error: ${error.message}`);
            return error;
        } else {
            this._filters = filters;
            this._channel.getEvents().afterFiltersListUpdated.emit(this._filters.map(f => Object.assign({}, f)));
            return undefined;
        }
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
                self._subscriptions.session.map = events.MapUpdated.subscribe(self._events().handlers.map);
            },
            unsubscribe(): void {
                Object.keys(self._subscriptions.session).forEach((key: string) => {
                    self._subscriptions.session[key].destroy();
                });
            },
            handlers: {
                search(rows: number): void {
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
            search(
                msg: IPC.SearchRequest,
                response: (instance: IPC.SearchRequestResults) => any,
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
                                        `Fail to subscribe to render event "StreamChunk" due error: ${error.message}. This is not blocked error, loading will be continued.`,
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
                    //
                },
                chunk(msg: IPC.SearchChunk, response: (isntance: IPC.SearchChunk) => any): void {
                    //
                },
            },
        };
    }
}
