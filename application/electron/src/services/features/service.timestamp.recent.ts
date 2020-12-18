import Logger from '../../tools/env.logger';
import ServiceElectron from '../service.electron';
import ServiceStorage from '../service.storage';

import { IPCMessages } from '../service.electron';
import { IStorageScheme } from '../service.storage';
import { IService } from '../../interfaces/interface.service';
import { Subscription } from '../../tools/index';

export const MAX_NUMBER_OF_RECENT_RECORDS = 15;

export class ServiceTimestampFormatRecent implements IService {

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Logger = new Logger('ServiceTimestampFormatRecent');

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(IPCMessages.TimestampFormatRecentRequest, this._ipc_TimestampFormatRecentRequest.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.TimestampFormatRecentRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to "FilterRecentRequest" due error: ${error.message}.`);
            });
            ServiceElectron.IPC.subscribe(IPCMessages.TimestampFormatRecentAdd, this._ipc_TimestampFormatRecentAdd.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.TimestampFormatRecentAdd = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to "FilterRecentRequest" due error: ${error.message}.`);
            });
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceTimestampFormatRecent';
    }

    public add(format: string) {
        const stored: IStorageScheme.IStorage = ServiceStorage.get().get();
        const formats: string[] = stored.recentDateTimeFormats.filter((f: string) => {
            return format !== f;
        });
        if (formats.length > MAX_NUMBER_OF_RECENT_RECORDS) {
            formats.splice(formats.length - 1, 1);
        }
        formats.unshift(format);
        ServiceStorage.get().set({
            recentDateTimeFormats: formats,
        }).catch((err: Error) => {
            this._logger.error(err.message);
        });
    }

    public get(): Promise<string[]> {
        return new Promise((resolve) => {
            const stored: IStorageScheme.IStorage = ServiceStorage.get().get();
            resolve(stored.recentDateTimeFormats);
        });
    }

    public clear() {
        ServiceStorage.get().set({
            recentFiles: [],
        }).catch((err: Error) => {
            this._logger.error(err.message);
        });
        ServiceElectron.updateMenu();
    }

    private _ipc_TimestampFormatRecentRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const stored: IStorageScheme.IStorage = ServiceStorage.get().get();
        response(new IPCMessages.TimestampFormatRecentResponse({
            formats: stored.recentDateTimeFormats,
        })).catch((error: Error) => {
            this._logger.warn(error.message);
        });
    }

    private _ipc_TimestampFormatRecentAdd(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.TimestampFormatRecentAdd = request as IPCMessages.TimestampFormatRecentAdd;
        if (req.format.trim() === '') {
            return;
        }
        this.add(req.format);
    }


}

export default (new ServiceTimestampFormatRecent());
