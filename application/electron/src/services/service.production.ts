
import Logger from '../tools/env.logger';
import ServiceEnv from './service.env';

import { LogsService, ELogLevels } from '../tools/env.logger';
import { IService } from '../interfaces/interface.service';


const CDEV_ENV_VAR_VALUE = 'ON';

/**
 * @class ServiceProduction
 * @description Just keep information about build type
 */

class ServiceProduction implements IService {

    private _logger: Logger = new Logger('ServiceProduction');
    private _production: boolean = true;
    private _logLevel: ELogLevels = ELogLevels.ERROR;

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
                this._logLevel = LogsService.strToLogLevel(logLevel);
            } else if (this._production) {
                this._logLevel = ELogLevels.ERROR;
            } else {
                this._logLevel = ELogLevels.ENV;
            }
            LogsService.setGlobalLevel(this._logLevel);
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

    public getLogLevel(): ELogLevels {
        return this._logLevel;
    }

}

export default (new ServiceProduction());
