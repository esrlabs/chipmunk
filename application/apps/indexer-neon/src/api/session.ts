import * as Events from '../util/events';
import * as Logs from '../util/logging';

import uuid from '../util/uuid';

import { RustSessionChannel, RustSessionChannelConstructor } from '../native/index';
import { SessionComputation, ISessionEvents } from './session.computation';
import { SessionStream } from './session.stream';
import { SessionSearch } from './session.search';
import { IComputationError } from '../interfaces/errors';

export {
    ISessionEvents,
    IEventMapUpdated,
    IEventMatchesUpdated,
    IEventSearchUpdated,
    IEventStreamUpdated,
} from './session.computation';

export { SessionComputation, SessionStream, SessionSearch };

export class Session {
    private _channel: RustSessionChannel | undefined;
    private _computation: SessionComputation | undefined;
    private _stream: SessionStream | undefined;
    private _search: SessionSearch | undefined;
    private readonly _uuid: string = uuid();
    private readonly _logger: Logs.Logger;

    constructor() {
        this._logger = Logs.getLogger(`Session: ${this._uuid}`);
    }

    public init(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const ready = (err?: IComputationError) => {
                Object.keys(subs).forEach((key: string) => {
                    subs[key].destroy();
                });
                if (err) {
                    reject(new Error(err.message));
                } else {
                    this._channel = channel;
                    this._computation = computation;
                    this._stream = new SessionStream(computation, channel, this._uuid);
                    this._search = new SessionSearch(computation, channel, this._uuid);
                    resolve();
                }
            };
            const subs: { [key: string]: Events.Subscription } = {};
            const computation = new SessionComputation(this._uuid);
            const channel = new RustSessionChannelConstructor(computation.getEmitter());
            subs.ready = computation.getEvents().ready.subscribe(() => {
                ready();
            });
            subs.error = computation.getEvents().error.subscribe((err: IComputationError) => {
                ready(err);
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._computation === undefined || this._channel === undefined) {
                return reject(new Error(`SessionComputation wasn't created`));
            }
            const computation = this._computation;
            const channel = this._channel;
            Promise.all([
                // Destroy stream controller
                (this._stream as SessionStream).destroy().catch((err: Error) => {
                    this._logger.error(
                        `Fail correctly destroy SessionStream due error: ${err.message}`,
                    );
                }),
                // Destroy search controller
                (this._search as SessionSearch).destroy().catch((err: Error) => {
                    this._logger.error(
                        `Fail correctly destroy SessionSearch due error: ${err.message}`,
                    );
                }),
            ])
                .catch((err: Error) => {
                    this._logger.error(`Error while destroying: ${err.message}`);
                })
                .finally(() => {
                    channel.destroy();
                    computation.getEvents().destroyed.subscribe(() => {
                        computation.destroy().then(resolve).catch(reject);
                    });
                });
        });
    }

    public getUUID(): string {
        return this._uuid;
    }

    public getEvents(): ISessionEvents | Error {
        if (this._computation === undefined) {
            return new Error(`SessionComputation wasn't created`);
        }
        return this._computation.getEvents();
    }

    public getStream(): SessionStream | Error {
        if (this._stream === undefined) {
            return new Error(`SessionStream wasn't created`);
        }
        return this._stream;
    }

    public getSearch(): SessionSearch | Error {
        if (this._search === undefined) {
            return new Error(`SessionSearch wasn't created`);
        }
        return this._search;
    }

    public reset(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getSocketPath(): string | Error {
        if (this._channel === undefined) {
            return new Error(`RustSessionChannel wasn't created`);
        }
        return this._channel.getSocketPath();
    }
}

export function createSession(): Promise<Session> {
    const logger: Logs.Logger = Logs.getLogger(`Session factory`);
    return new Promise((resolve, reject) => {
        const session = new Session();
        session
            .init()
            .then(() => {
                resolve(session);
            })
            .catch((err: Error) => {
                logger.error(`Fail to create a session due error: ${err.message}`);
                reject(err);
            });
    });
}
