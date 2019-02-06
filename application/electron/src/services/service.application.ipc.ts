import Logger from '../../platform/node/src/env.logger';
import ControllerApplicationIpc from '../controllers/controller.applications.ipc';
import { IService } from '../interfaces/interface.service';

declare var global: any;

/**
 * @class ServiceApplicationIPC
 * @description Inits application IPC global object
 */

class ServiceApplicationIPC implements IService {

    private _logger: Logger = new Logger('ServiceApplicationIPC');

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!global) {
                return reject(new Error(this._logger.error(`Cannot find "global" object.`)));
            }
            // Create application IPC controller in global namespace
            global.IPC = new ControllerApplicationIpc();
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceApplicationIPC';
    }

}

export default (new ServiceApplicationIPC());
