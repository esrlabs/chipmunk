import * as Events from '../util/events';
import * as Logs from '../util/logging';

import { RustChannelRequiered } from '../native/native.channel.required';
import { IEventsInterfaces, IEventsSignatures, IEvents, EErrorSeverity } from '../interfaces/computation.minimal';

type TShutdownComputationResolver = () => void;

export abstract class Computation<TEvents> {

    private _shutdownResolver: TShutdownComputationResolver | undefined;
    private _destroyed: boolean = false;
    private _uuid: string;
    private readonly _channel: Required<RustChannelRequiered>;
    private readonly _logger: Logs.Logger;

    constructor(channel: Required<RustChannelRequiered>, uuid: string) {
        this._channel = channel;
        this._uuid = uuid;
        this._polling = this._polling.bind(this);
        this._logger = Logs.getLogger(`${this.getName()}: ${uuid}`);
        // Start the polling loop on next iteration of the JS event loop
        setImmediate(this._polling);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._destroyed) {
                return reject(new Error(`Computation is already destroying`));
            }
            if (this._shutdownResolver !== undefined) {
                return reject(new Error(`Destroy method was already called.`));
            }
            // Store resolver
            this._shutdownResolver = resolve;
        });
    }

    public abstract getName(): string;

    public abstract getEvents(): TEvents & IEvents;

    public abstract getEventsSignatures(): Required<IEventsSignatures>;

    public abstract getEventsInterfaces(): Required<IEventsInterfaces>;

    private _polling() {
        if (this._shutdownResolver !== undefined) {
            this._logger.debug("shutdown had been requested, now accepted!");
            this._channel.shutdown();
        }
        if (this._destroyed) {
            // In case if shutdown operation was done too fast
            return;
        }
        // Poll for data
        this._channel.poll((
            err: string | undefined | null,
            event: string | undefined | null,
            args: { [key: string]: any } | undefined | null) => {
            if (err) {
                this._logger.error("Error on pull: " + err);
                this.getEvents().error.emit({ 
                    severity: EErrorSeverity.error,
                    content: err
                });
            }
            else if (event) {
                if (event == this.getEventsSignatures().destroyed) {
                    return this._destroy();
                }
                this._emit(event, args);
            }
            setImmediate(this._polling);
        });
    }

    private _destroy() {
        this._destroyed = true;
        // Emit destroy event
        this.getEvents().destroyed.emit();
        // Unsubscribe all event listeners
        Object.keys(this.getEvents()).forEach((key: string) => {
            (this.getEvents() as any)[key].destroy();
        });
        // Call resolver
        if (this._shutdownResolver !== undefined) { 
            this._shutdownResolver();
        }
        this._logger.debug("shutdown is done");
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
            const err: Error | undefined = Events.Subject.validate((this.getEventsInterfaces() as any)[event], data);
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
