import Logger from '../../tools/env.logger';
import ServiceElectron, { IPCMessages as IPCElectronMessages } from '../../services/service.electron';

const CSettings = {
    notificationDelayOnStream: 250,
};

export default class ControllerStreamAdbPostman {

    private _logger: Logger;
    private _streamId: string;
    private _notification: { timer: any, last: number } = { timer: -1, last: 0 };
    private _destroyed: boolean = false;
    private _working: boolean = false;

    constructor(streamId: string) {
        this._streamId = streamId;
        this._logger = new Logger(`ControllerStreamAdbPostman: ${this._streamId}`);
    }

    public destroy() {
        clearTimeout(this._notification.timer);
        this._destroyed = true;
    }

    public notification(amount: number, ignoreQueue: boolean = false): void {
        if (this._destroyed) {
            this._logger.warn(`Attempt to notify after postman was destroyed.`);
            return;
        }
        clearTimeout(this._notification.timer);
        const past: number = Date.now() - this._notification.last;
        if (!this._working && (past >= CSettings.notificationDelayOnStream || ignoreQueue)) {
            this._notify(amount);
            return;
        }
        const delay = past > CSettings.notificationDelayOnStream ? 0 : (CSettings.notificationDelayOnStream - past);
        this._notification.timer = setTimeout(() => {
            this._notify(amount);
        }, delay);
    }

    private _notify(amount: number): void {
        this._notification.last = Date.now();
        this._working = true;
        ServiceElectron.IPC.send(new IPCElectronMessages.AdbStreamUpdated({
            guid: this._streamId,
            amount: amount,
        })).then(() => {
            this._working = false;
        }).catch((error: Error) => {
            this._logger.warn(`Fail send notification to render due error: ${error.message}`);
        });
    }

}
