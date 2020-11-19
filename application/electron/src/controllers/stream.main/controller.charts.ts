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

export class Charts extends Dependency {
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

    constructor(session: Session) {
        super();
        this._logger = new Logger(`Charts: ${session.getUUID()}`);
        this._session = session;
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
                            this._logger.warn(
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
}
