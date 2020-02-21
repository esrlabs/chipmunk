import Logger, { LogsService, ELogLevels } from '../tools/env.logger';
import { IService } from '../interfaces/interface.service';

import ServiceEnv from './service.env';

const CDEV_ENV_VAR_VALUE = 'ON';

/**
 * @class ServiceProduction
 * @description Just keep information about build type
 */

class ServiceProduction implements IService {

    private _logger: Logger = new Logger('ServiceProduction');
    private _production: boolean = true;

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve) => {
            if (ServiceEnv.get().CHIPMUNK_DEVELOPING_MODE === CDEV_ENV_VAR_VALUE) {
                this._production = false;
            } else {
                this._production = true;
            }
            this._logger.debug(`Production is: ${this._production ? 'ON' : 'OFF'}`);
            const logLevel: string | undefined = ServiceEnv.get().CHIPMUNK_DEV_LOGLEVEL;
            if (logLevel !== undefined && LogsService.isValidLevel(logLevel)) {
                LogsService.setGlobalLevel(logLevel as ELogLevels);
            } else if (this._production) {
                LogsService.setGlobalLevel(ELogLevels.ERROR);
            } else {
                LogsService.setGlobalLevel(ELogLevels.ENV);
            }
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceProduction';
    }

    public isProduction(): boolean {
        return this._production;
    }

}

export default (new ServiceProduction());
