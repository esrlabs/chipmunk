import Logger from './env.logger';
import ServiceElectron, { IPCMessages as IPCElectronMessages } from '../services/service.electron';

export class Postman<T> {

    private readonly _logger: Logger;
    private readonly _alias: string;
    private readonly _notification: { timer: any, last: number } = { timer: -1, last: 0 };
    private readonly _delay: number;
    private readonly _message: () => Error | T & IPCElectronMessages.TMessage;
    private _destroyed: boolean = false;
    private _working: boolean = false;

    constructor(alias: string, delay: number, message: () => Error | T & IPCElectronMessages.TMessage) {
        this._alias = alias;
        this._delay = delay;
        this._message = message;
        this._logger = new Logger(`Postman: ${this._alias}`);
    }

    public destroy() {
        clearTimeout(this._notification.timer);
        this._destroyed = true;
    }

    public notify(ignoreQueue: boolean = false): void {
        if (this._destroyed) {
            this._logger.warn(`Attempt to notify after postman was destroyed.`);
            return;
        }
        clearTimeout(this._notification.timer);
        const past: number = Date.now() - this._notification.last;
        if (!this._working && (past >= this._delay || ignoreQueue)) {
            this._notify();
            return;
        }
        const delay = past > this._delay ? 0 : (this._delay - past);
        this._notification.timer = setTimeout(() => {
            this._notify();
        }, delay);
    }

    private _notify(): void {
        this._notification.last = Date.now();
        this._working = true;
        const msg = this._message();
        if (msg instanceof Error) {
            this._working = false;
            this._logger.warn(`Message wouldn't be sent because error: ${msg.message}`);
            return;
        }
        ServiceElectron.IPC.send(msg).then(() => {
            this._working = false;
        }).catch((error: Error) => {
            this._logger.warn(`Fail send notification to render due error: ${error.message}`);
        });
    }

}
