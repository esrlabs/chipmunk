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

export class Charts extends Dependency {
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
        this._logger = new Logger(`Charts: ${session.getUUID()}`);
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
        return 'Charts';
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

    public setCharts(filters: CommonInterfaces.API.IFilter[]): Error | undefined {
        function getMixedFiltersList(
            a: CommonInterfaces.API.IFilter[],
            b: CommonInterfaces.API.IFilter[],
        ): CommonInterfaces.API.IFilter[] {
            const added: string[] = [];
            const result: CommonInterfaces.API.IFilter[] = a.map((filter) => {
                added.push(`${filter.filter}${JSON.stringify(filter.flags)}`);
                return filter;
            });
            b.forEach((filter) => {
                const hash: string = `${filter.filter}${JSON.stringify(filter.flags)}`;
                if (!added.includes(hash)) {
                    result.push(filter);
                }
            });
            return result;
        }
        const error: Error | undefined = this._search.setMatches(getMixedFiltersList(this._charts, this._filters));
        if (error instanceof Error) {
            this._logger.warn(`Fail to set filters for search due error: ${error.message}`);
            return error;
        } else {
            this._charts = filters;
            return undefined;
        }
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
            chart(
                msg: IPC.ChartRequest,
                response: (instance: IPC.ChartRequestResults) => any,
            ): void;
        };
    } {
        const self = this;
        return {
            subscribe(): Promise<void> {
                return Promise.all([
                    ServiceElectron.IPC.subscribe(
                        IPC.ChartRequest,
                        self._ipc().handlers.chart as any,
                    )
                        .then((subscription: Subscription) => {
                            self._subscriptions.ipc.chart = subscription;
                        })
                        .catch((error: Error) => {
                            self._logger.warn(
                                `Fail to subscribe to render event "ChartRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`,
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
                chart(
                    msg: IPC.ChartRequest,
                    response: (instance: IPC.ChartRequestResults) => any,
                ): void {
                    //
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
