import * as Events from '../util/events';
import * as Logs from '../util/logging';

import uuid from '../util/uuid';

import { RustSession, RustSessionConstructor } from '../native/index';
import { EventProvider, ISessionEvents, IError } from './session.provider';
import { SessionStream } from './session.stream';
import { SessionSearch } from './session.search';
import { IOrderStat } from '../provider/provider';

export {
    ISessionEvents,
    IProgressEvent,
    IProgressState,
    IEventMapUpdated,
    IEventMatchesUpdated,
} from './session.provider';

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
        this._session = new RustSessionConstructor(this._uuid, this._provider);
        this._stream = new SessionStream(this._provider, this._session, this._uuid);
        this._search = new SessionSearch(this._provider, this._session, this._uuid);
        this._subs.SessionError = this._provider
            .getEvents()
            .SessionError.subscribe((err: IError) => {
                this._logger.error(
                    `Session "${this._uuid}" would be destroyed because of error: [${err.kind}/${err.severity}]:: ${err.message}`,
                );
            });
        this._subs.SessionDestroyed = this._provider.getEvents().SessionDestroyed.subscribe(() => {
            this._logger.warn(
                `Destroy event has been gotten unexpectedly. Force destroy of session.`,
            );
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
                            this._logger.debug(
                                `Confirmation of session destroying has been received`,
                            );
                            this._provider.destroy().then(resolve).catch(reject);
                        });
                        this._session.destroy();
                    } else {
                        this._provider.destroy().then(resolve).catch(reject);
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

    public getNativeSession(): RustSession {
        return this._session;
    }

    /**
     * Switch session provider into debug mode
     * Shows addition logs related to lifecircle
     * @param state {boolean}: true - debug mode ON; false - debug mode OFF
     */
    public debug(state: boolean) {
        this._provider.debug().setStoring(state);
        this._provider.debug().setTracking(state);
        this._provider.debug().setCount(state);
    }

    /**
     * Returns debug information:
     * - unsupported - list of unsupported events. Events come from rust side to typescript side
     * - error - list of errors on provider level
     * Note: data will be available only if debug mode is ON
     * @returns {
     *   unsupported: number;
     *   errors: number;
     * }
     */
    public getDebugStat(): {
        unsupported: string[];
        errors: string[];
        order: IOrderStat[];
        counter: { [key: string]: number };
        operations: { [key: string]: number };
    } {
        return {
            unsupported: this._provider.debug().stat.unsupported(),
            errors: this._provider.debug().stat.error(),
            order: this._provider.debug().stat.order(),
            counter: this._provider.debug().stat.counter(),
            operations: this._provider.debug().stat.operations(),
        };
    }

    public printDebugStat(stdout: boolean): void {
        const stat = this.getDebugStat();
        const output = stdout ? console.log : this._logger.debug;
        const max = 72;
        const format = (str: string): string => {
            return `│ ${str}${' '.repeat(max > str.length - 3 ? max - str.length - 3 : 0)}│`;
        };
        output(`┌${'─'.repeat(70)}┐`);
        output(format(`Stat information. Session: ${this._uuid}`));
        output(`├${'─'.repeat(70)}┤`);
        output(format(`Events:`));
        Object.keys(stat.counter).forEach((event: string) => {
            output(format(`  - [${event}]: ${stat.counter[event]}`));
        });
        output(format(`Operations:`));
        Object.keys(stat.operations).forEach((op: string) => {
            output(format(`  - [${op}]: ${stat.operations[op]}`));
        });
        output(format(`Flow:`));
        stat.order.forEach((entity: IOrderStat, i: number) => {
            output(format(`  ${i + 1}. [${entity.type}] ${entity.name}`));
        });
        if (stat.unsupported.length === 0) {
            output(format(`Unsupported events: nothing`));
        } else {
            output(format(`Unsupported events:`));
            stat.unsupported.forEach((event: string, i: number) => {
                output(format(`  - ${event}`));
            });
        }
        if (stat.errors.length === 0) {
            output(format(`Errors: no errors`));
        } else {
            output(format(`Errors:`));
            stat.errors.forEach((event: string, i: number) => {
                output(format(`  - ${event}`));
            });
        }
        output(`└${'─'.repeat(70)}┘`);
    }
}
