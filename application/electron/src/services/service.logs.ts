import Logger from '../tools/env.logger';
import ServiceElectron from './service.electron';
import ServiceProduction from './service.production';
import ServiceEnv from './service.env';

import { IService } from '../interfaces/interface.service';
import { IPCMessages, Subscription } from './service.electron';

/**
 * @class ServiceLogs
 * @description Bridge to render's logs
 */

class ServiceLogs implements IService {

    private _logger: Logger = new Logger('ServiceLogs');
    private _subscriptions: { [key: string ]: Subscription } = { };

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.ChipmunkDevModeRequest, this._ipc_onChipmunkDevModeRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.ChipmunkDevModeRequest = subscription;
                }).catch((error: Error) => {
                    this._logger.warn(`Fail to subscribe to render event "ChipmunkDevModeRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.ChipmunkLogLevelRequest, this._ipc_onChipmunkLogLevelRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.ChipmunkLogLevelRequest = subscription;
                }).catch((error: Error) => {
                    this._logger.warn(`Fail to subscribe to render event "ChipmunkLogLevelRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.ChipmunkLogRequest, this._ipc_onChipmunkLogRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.ChipmunkLogRequest = subscription;
                }).catch((error: Error) => {
                    this._logger.warn(`Fail to subscribe to render event "ChipmunkLogRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
                }),
            ]).then(() => {
                resolve();
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
        return 'ServiceLogs';
    }

    private _ipc_onChipmunkDevModeRequest(req: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        response(new IPCMessages.ChipmunkDevModeResponse({ production: ServiceProduction.isProduction()})).catch((err: Error) => {
            this._logger.warn(`Fail to send ChipmunkDevModeResponse due error: ${err.message}`);
        });
    }

    private _ipc_onChipmunkLogLevelRequest(req: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        response(new IPCMessages.ChipmunkLogLevelResponse({ level: ServiceProduction.getLogLevel() as IPCMessages.ELogLevels})).catch((err: Error) => {
            this._logger.warn(`Fail to send ChipmunkLogLevelResponse due error: ${err.message}`);
        });
    }

    private _ipc_onChipmunkLogRequest(req: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const request: IPCMessages.ChipmunkLogRequest = req as IPCMessages.ChipmunkLogRequest;
        if (!ServiceEnv.get().CHIPMUNK_NO_RENDER_LOGS && typeof request.msg === 'string' && request.msg.trim() !== '') {
            this._logger.publish('RENDER: ' + request.msg, request.level);
        }
        response(new IPCMessages.ChipmunkLogResponse({ })).catch((err: Error) => {
            this._logger.warn(`Fail to send ChipmunkLogResponse due error: ${err.message}`);
        });
    }

}

export default (new ServiceLogs());
