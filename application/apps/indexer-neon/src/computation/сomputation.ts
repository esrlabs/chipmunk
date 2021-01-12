import * as Events from '../util/events';
import * as Logs from '../util/logging';

import { TEventData, TEventEmitter, IEventData } from './computation.general';
import { IEventsInterfaces, IEventsSignatures, IEvents } from './computation.minimal';
import { EErrorSeverity } from '../interfaces/errors';

export abstract class Computation<TEvents> {
    private _destroyed: boolean = false;
    public readonly logger: Logs.Logger;

    constructor(uuid: string) {
        this._emitter = this._emitter.bind(this);
        this.logger = Logs.getLogger(`${this.getName()}: ${uuid}`);
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

    /**
     * We are expecting to get from rust event data as JSON string. Required format is:
     * { type: string, data?: string }
     * @param data {string}
     */
    private _emitter(data: TEventData) {
        this.logger.debug(`Has been gotten rust event: ${JSON.stringify(data)}`);
        let event: Required<IEventData>;
        if (typeof data === 'string') {
            try {
                event = JSON.parse(data);
            } catch (e) {
                this.logger.error(
                    `Fail to parse event data due error: ${e}.\nExpecting type (JSON string): { type: string, data?: string }`,
                );
                return;
            }
        } else if (typeof data === 'object' && data !== null) {
            event = data;
        } else {
            this.logger.error(
                `Unsupported format of event data: ${typeof data} / ${data}.\nExpecting type (JSON string): { type: string, data?: string }`,
            );
            return;
        }
        if (Object.keys(event).length !== 1) {
            this.logger.error(
                `Has been gotten incorrect event data: ${data}. No "type" field found.\nExpecting type (JSON string): { type: string, data?: string }`,
            );
            return;
        }
        const type: string = Object.keys(event)[0];
        const body: any = event[type];
        if (type === this.getEventsSignatures().destroyed) {
            return this._destroy();
        }
        
        this._emit(type, body);
    }

    private _destroy() {
        this._destroyed = true;
        // Emit destroy event
        this.getEvents().destroyed.emit();
        // Unsubscribe all event listeners
        Object.keys(this.getEvents()).forEach((key: string) => {
            (this.getEvents() as any)[key].destroy();
        });
        this.logger.debug('destroyed');
    }

    private _emit(event: string, data: any) {
        if ((this.getEventsSignatures() as any)[event] === undefined) {
            const errMsg = `Has been gotten unsupported event: "${event}".`;
            this.getEvents().error.emit({
                severity: EErrorSeverity.logs,
                message: errMsg,
            });
            this.logger.error(errMsg);
        } else {
            const err: Error | undefined = Events.Subject.validate(
                (this.getEventsInterfaces() as any)[event],
                data,
            );
            if (err instanceof Error) {
                const errMsg = `Fail to parse event "${event}" due error: ${err.message}`;
                this.getEvents().error.emit({
                    severity: EErrorSeverity.logs,
                    message: errMsg,
                });
                this.logger.error(errMsg);
            } else {
                (this.getEvents() as any)[event].emit(data);
            }
        }
    }

    public getEmitter(): TEventEmitter {
        return this._emitter;
    }
}
