import Logger from '../tools/env.logger';
import ServiceElectron, { IPCMessages as IPCElectronMessages } from '../services/service.electron';
import BytesRowsMap, { IMapItem } from './controller.stream.processor.map';
import StreamFileReader from './controller.stream.file.reader';

const CSettings = {
    notificationDelayOnStream: 500,             // ms, Delay for sending notifications about stream's update to render (client) via IPC, when stream is blocked
    maxPostponedNotificationMessages: 500,      // How many IPC messages to render (client) should be postponed via timer
    chunkDelayOnStream: 1000,
    maxPostponedChunksMessages: 500,
};

export default class ControllerStreamUpdatesPostman {

    private _logger: Logger;
    private _streamId: string;
    private _notification: { timer: any, attempts: number } = { timer: -1, attempts: 0 };
    private _map: BytesRowsMap;
    private _destroyed: boolean = false;

    constructor(streamId: string, map: BytesRowsMap) {
        this._streamId = streamId;
        this._map = map;
        this._logger = new Logger(`ControllerStreamUpdatesPostman: ${this._streamId}`);
    }

    public destroy() {
        clearTimeout(this._notification.timer);
        this._destroyed = true;
    }

    public notification(): void {
        if (this._destroyed) {
            this._logger.warn(`Attempt to notify after postman was destroyed.`);
            return;
        }
        clearTimeout(this._notification.timer);
        if (this._notification.attempts > CSettings.maxPostponedNotificationMessages) {
            return this._notify();
        }
        this._notification.attempts += 1;
        this._notification.timer = setTimeout(() => {
            this._notify();
        }, CSettings.notificationDelayOnStream);
    }

    private _notify(): void {
        this._notification.attempts = 0;
        ServiceElectron.IPC.send(new IPCElectronMessages.StreamUpdated({
            guid: this._streamId,
            length: this._map.getByteLength(),
            rowsCount: this._map.getRowsCount(),
        })).catch((error: Error) => {
            this._logger.warn(`Fail send notification to render due error: ${error.message}`);
        });
    }

}
