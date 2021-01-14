// tslint:disable: member-ordering
import * as Tools from '../../tools/index';

import ServiceElectron from '../../services/service.electron';
import Logger from '../../tools/env.logger';

import { Postman } from '../../tools/postman';
import { IPCMessages as IPC, Subscription } from '../../services/service.electron';
import { Session, Events } from 'indexer-neon';
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

export class Stream extends Dependency {
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
    private readonly _postman: Postman<IPC.StreamUpdated>;
    private _filters: CommonInterfaces.API.IFilter[] = [];

    constructor(session: Session, channel: Channel) {
        super();
        this._logger = new Logger(`Stream: ${session.getUUID()}`);
        this._session = session;
        this._channel = channel;
        this._postman = new Postman<IPC.StreamUpdated>(session.getUUID(), 250, () => {
            const stream = session.getStream();
            if (stream instanceof Error) {
                return stream;
            }
            return new IPC.StreamUpdated({
                guid: this._session.getUUID(),
                rows: stream.len(),
            });
        });
    }

    public getName(): string {
        return 'Stream';
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
            stream(rows: number): void;
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
                self._subscriptions.session.stream = events.StreamUpdated.subscribe(
                    self._events().handlers.stream,
                );
            },
            unsubscribe(): void {
                Object.keys(self._subscriptions.session).forEach((key: string) => {
                    self._subscriptions.session[key].destroy();
                });
            },
            handlers: {
                stream(rows: number): void {
                    self._postman.notify();
                },
            },
        };
    }

    private _ipc(): {
        subscribe(): Promise<void>;
        unsubscribe(): void;
        handlers: {
            chunk(msg: IPC.StreamChunk, response: (isntance: IPC.StreamChunk) => any): void;
        };
    } {
        const self = this;
        return {
            subscribe(): Promise<void> {
                return Promise.all([
                    ServiceElectron.IPC.subscribe(
                        IPC.StreamChunk,
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
                chunk(msg: IPC.StreamChunk, response: (isntance: IPC.StreamChunk) => any): void {
                    if (msg.guid !== self._session.getUUID()) {
                        return;
                    }
                    const stream = self._session.getStream();
                    if (stream instanceof Error) {
                        return response(
                            new IPC.StreamChunk({
                                error: self._logger.warn(
                                    `Fail to access session controller due error: ${stream.message}`,
                                ),
                                start: msg.start,
                                end: msg.end,
                                guid: msg.guid,
                            }),
                        );
                    }
                    const rows = stream.grab(msg.start, msg.end - msg.start);
                    if (!(rows instanceof Array)) {
                        return response(
                            new IPC.StreamChunk({
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
                        new IPC.StreamChunk({
                            start: msg.start,
                            end: msg.end,
                            guid: msg.guid,
                            data: rows.map((r) => r.content).join('\n'),
                            rows: stream.len(),
                        }),
                    );
                },
            },
        };
    }
}
