import * as Events from '../util/events';
import * as Logs from '../util/logging';

import { ERustEmitterEvents, TEventEmitter } from '../native/native';
import {
    IEventsInterfaces,
    IEventsSignatures,
    IEvents,
    EErrorSeverity,
} from '../interfaces/computation.minimal';

export abstract class Computation<TEvents> {
    private _destroyed: boolean = false;
    private _uuid: string;
    private readonly _logger: Logs.Logger;

    constructor(uuid: string) {
        this._uuid = uuid;
        this._emitter = this._emitter.bind(this);
        this._logger = Logs.getLogger(`${this.getName()}: ${uuid}`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._destroyed) {
                return reject(new Error(`Computation is already destroying`));
            }
            this._destroy();
            resolve();
        });
    }

    public abstract getName(): string;

    public abstract getEvents(): TEvents & IEvents;

    public abstract getEventsSignatures(): Required<IEventsSignatures>;

    public abstract getEventsInterfaces(): Required<IEventsInterfaces>;

    private _emitter(event: ERustEmitterEvents, data: any) {
        if (event == this.getEventsSignatures().destroyed) {
            return this._destroy();
        }
        this._emit(event, data);
    }

    public getEmitter(): TEventEmitter {
        return this._emitter;
    }

    private _destroy() {
        this._destroyed = true;
        // Emit destroy event
        this.getEvents().destroyed.emit();
        // Unsubscribe all event listeners
        Object.keys(this.getEvents()).forEach((key: string) => {
            (this.getEvents() as any)[key].destroy();
        });
        this._logger.debug('destroyed');
    }

    private _emit(event: string, data: any) {
        if ((this.getEventsSignatures() as any)[event] === undefined) {
            const errMsg = `Has been gotten unsupported event: "${event}".`;
            this.getEvents().error.emit({
                severity: EErrorSeverity.logs,
                content: errMsg,
            });
            this._logger.error(errMsg);
        } else {
            const err: Error | undefined = Events.Subject.validate(
                (this.getEventsInterfaces() as any)[event],
                data,
            );
            if (err instanceof Error) {
                const errMsg = `Fail to parse event "${event}" due error: ${err.message}`;
                this.getEvents().error.emit({
                    severity: EErrorSeverity.logs,
                    content: errMsg,
                });
                this._logger.error(errMsg);
            } else {
                (this.getEvents() as any)[event].emit(data);
            }
        }
    }
}
