import * as Events from '../util/events';
import * as Logs from '../util/logging';

import { TEventData, TEventEmitter, IEventData } from './provider.general';

export abstract class Computation<TEvents, IEventsSignatures, IEventsInterfaces> {
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

    public abstract getEvents(): TEvents;

    public abstract getEventsSignatures(): IEventsSignatures;

    public abstract getEventsInterfaces(): IEventsInterfaces;

    /**
     * We are expecting to get from rust event data as JSON string. Required format is:
     * { [type: string]: string | undefined }
     * @param data {string}
     */
    private _emitter(data: TEventData) {
        function dataAsStr(data: TEventData): string {
            if (typeof data === 'string') {
                return `(defined as string): ${data}`;
            } else {
                return `(defined as object): keys: ${Object.keys(data).join(
                    ', ',
                )} / values: ${Object.keys(data)
                    .map((k) => JSON.stringify(data[k]))
                    .join(', ')}`;
            }
        }
        this.logger.debug(`Has been gotten rust event:\n\t${dataAsStr(data)}`);
        let event: Required<IEventData>;
        if (typeof data === 'string') {
            try {
                event = JSON.parse(data);
            } catch (e) {
                this.logger.error(
                    `Fail to parse event data due error: ${e}.\nExpecting type (JSON string): { [type: string]: string | undefined }`,
                );
                return;
            }
        } else if (typeof data === 'object' && data !== null) {
            event = data;
        } else {
            this.logger.error(
                `Unsupported format of event data: ${typeof data} / ${data}.\nExpecting type (JSON string): { [type: string]: string | undefined }`,
            );
            return;
        }
        if (Object.keys(event).length !== 1) {
            this.logger.error(
                `Has been gotten incorrect event data: ${data}. No "type" field found.\nExpecting type (JSON string): { [type: string]: string | undefined }`,
            );
            return;
        }
        const type: string = Object.keys(event)[0];
        const body: any = event[type];
        this._emit(type, body);
    }

    private _destroy() {
        this._destroyed = true;
        // Unsubscribe all event listeners
        Object.keys(this.getEvents()).forEach((key: string) => {
            (this.getEvents() as any)[key].destroy();
        });
        this.logger.debug('destroyed');
    }

    private _emit(event: string, data: any) {
        if ((this.getEventsSignatures() as any)[event] === undefined) {
            this.logger.error(`Has been gotten unsupported event: "${event}".`);
        } else {
            const err: Error | undefined = Events.Subject.validate(
                (this.getEventsInterfaces() as any)[event],
                data,
            );
            if (err instanceof Error) {
                this.logger.error(`Fail to parse event "${event}" due error: ${err.message}`);
            } else {
                (this.getEvents() as any)[event].emit(data);
            }
        }
    }

    public getEmitter(): TEventEmitter {
        return this._emitter;
    }
}
