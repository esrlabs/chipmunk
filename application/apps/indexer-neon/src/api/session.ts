import * as Events from '../util/events';
import * as Logs from '../util/logging';

import uuid from '../util/uuid';

import { RustSession, RustSessionConstructor } from '../native/index';
import { EventProvider, ISessionEvents, IError } from './session.provider';
import { SessionStream } from './session.stream';
import { SessionSearch } from './session.search';

export { ISessionEvents, IProgressEvent, IProgressState, IEventMapUpdated, IEventMatchesUpdated } from './session.provider';

export { EventProvider, SessionStream, SessionSearch };

enum ESessionState {
    destroyed,
    available,
}

export class Session {
    private readonly _session: RustSession;
    private readonly _provider: EventProvider;
    private readonly _stream: SessionStream | undefined;
    private readonly _search: SessionSearch | undefined;
    private readonly _uuid: string = uuid();
    private readonly _logger: Logs.Logger;
    private readonly _subs: { [key: string]: Events.Subscription } = {};
    private _state: ESessionState = ESessionState.available;

    constructor() {
        this._logger = Logs.getLogger(`Session: ${this._uuid}`);
        this._provider = new EventProvider(this._uuid);
        this._session = new RustSessionConstructor(
            this._uuid,
            this._provider.getEmitter(),
        );
        this._stream = new SessionStream(this._provider, this._session, this._uuid);
        this._search = new SessionSearch(this._provider, this._session, this._uuid);
        this._subs.SessionError = this._provider.getEvents().SessionError.subscribe((err: IError) => {
            // log error
        });
        this._subs.SessionDestroyed = this._provider.getEvents().SessionDestroyed.subscribe(() => {
            this._logger.warn(`Destroy event has been gotten unexpectedly. Force destroy of session.`);
            this.destroy(true);
        });
    }

    public destroy(unexpectedly: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            Object.keys(this._subs).forEach((key: string) => {
                this._subs[key].destroy();
            });
            if (this._state === ESessionState.destroyed) {
                return reject(new Error(`Session is already destroyed or destroing`));
            }
            this._state = ESessionState.destroyed;
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
                    if (!unexpectedly) {
                        this._provider.getEvents().SessionDestroyed.subscribe(() => {
                            this._provider.destroy().then(resolve).catch(reject);
                        });
                        this._session.destroy();
                    } else {
                        resolve();
                    }
                });
        });
    }

    public getUUID(): string {
        return this._uuid;
    }

    public getEvents(): ISessionEvents | Error {
        if (this._provider === undefined) {
            return new Error(`EventProvider wasn't created`);
        }
        return this._provider.getEvents();
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
        if (this._session === undefined) {
            return new Error(`RustSession wasn't created`);
        }
        return this._session.getSocketPath();
    }

}

