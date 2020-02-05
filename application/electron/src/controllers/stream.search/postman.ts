import Logger from '../../tools/env.logger';
import ServiceElectron, { IPCMessages as IPCElectronMessages } from '../../services/service.electron';
import BytesRowsMap from './file.map';

const CSettings = {
    notificationDelayOnStream: 250,             // ms, Delay for sending notifications about stream's update to render (client) via IPC, when stream is blocked
};

export default class ControllerSearchUpdatesPostman {

    private _logger: Logger;
    private _streamId: string;
    private _notification: { timer: any, last: number } = { timer: -1, last: 0 };
    private _map: BytesRowsMap;
    private _destroyed: boolean = false;
    private _working: boolean = false;

    constructor(streamId: string, map: BytesRowsMap) {
        this._streamId = streamId;
        this._map = map;
        this._logger = new Logger(`ControllerSearchUpdatesPostman: ${this._streamId}`);
    }

    public destroy() {
        clearTimeout(this._notification.timer);
        this._destroyed = true;
    }

    public notification(ignoreQueue: boolean = false): void {
        if (this._destroyed) {
            this._logger.warn(`Attempt to notify after postman was destroyed.`);
            return;
        }
        clearTimeout(this._notification.timer);
        const past: number = Date.now() - this._notification.last;
        if (!this._working && (past >= CSettings.notificationDelayOnStream || ignoreQueue)) {
            this._notify();
            return;
        }
        const delay = past > CSettings.notificationDelayOnStream ? 0 : (CSettings.notificationDelayOnStream - past);
        this._notification.timer = setTimeout(() => {
            this._notify();
        }, delay);
    }

    private _notify(): void {
        this._notification.last = Date.now();
        this._working = true;
        ServiceElectron.IPC.send(new IPCElectronMessages.SearchUpdated({
            guid: this._streamId,
            length: this._map.getByteLength(),
            rowsCount: this._map.getRowsCount(),
        })).then(() => {
            this._working = false;
        }).catch((error: Error) => {
            this._logger.warn(`Fail send notification to render due error: ${error.message}`);
        });
    }

}
