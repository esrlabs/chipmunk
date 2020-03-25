import Logger from '../tools/env.logger';
import ServiceProduction from './service.production';
import ServiceElectron from './service.electron';

import { IService } from '../interfaces/interface.service';
import { IApplication, EExitCodes } from '../interfaces/interface.app';
import { IPCMessages, Subscription } from './service.electron';

const CSettings = {
    delay: 10000,
};

/**
 * @class ServiceAppState
 * @description Log information about state of application
 */

class ServiceAppState implements IService {

    private _logger: Logger = new Logger('ServiceAppState');
    private _subscriptions: { [key: string ]: Subscription } = { };
    private _timer: any = -1;
    private _app: IApplication | undefined;
    private _memory: {
        prev: number,
    } = {
        prev: 0,
    };

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(app: IApplication): Promise<void> {
        return new Promise((resolve, reject) => {
            this._app = app;
            this._check();
            this._subscribe().then(() => {
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
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
        return 'ServiceAppState';
    }

    private _subscribe(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.AppRestartRequest, this._ipc_AppRestartRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.AppRestartRequest = subscription;
                }),
            ]).then(() => {
                resolve();
            }).catch(reject);
        });
    }

    private _check() {
        if (ServiceProduction.isProduction()) {
            return;
        }
        this._timer = setTimeout(() => {
            const mem = process.memoryUsage();
            const change = mem.heapUsed - this._memory.prev;
            this._memory.prev = mem.heapUsed;
            this._logger.env(`memory usage: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} / ${(mem.heapTotal / 1024 / 1024).toFixed(2)} Mb (${change > 0 ? '↑' : '↓'} ${(change / 1024 / 1024).toFixed(2)} Mb)`);
            this._check();
        }, CSettings.delay);
    }

    private _ipc_AppRestartRequest() {
        this._app?.destroy(EExitCodes.restart).catch((error: Error) => {
            this._logger.warn(`Fail destroy app due error: ${error.message}`);
        });
    }

}

export default (new ServiceAppState());
