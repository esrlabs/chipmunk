import Logger, { LogsService, ELogLevels } from '../tools/env.logger';
import { getEnvVar } from 'chipmunk.shell.env';
import { IService } from '../interfaces/interface.service';

const CDEV_ENV_VAR = 'CHIPMUNK_DEVELOPING_MODE';
const CDEV_LOG_LEVEL = 'CHIPMUNK_DEV_LOGLEVEL';
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
            getEnvVar(CDEV_ENV_VAR).then((value: string) => {
                if (value === CDEV_ENV_VAR_VALUE) {
                    this._production = false;
                } else {
                    this._production = true;
                }
                this._logger.debug(`Production is: ${this._production ? 'ON' : 'OFF'}`);
                getEnvVar(CDEV_LOG_LEVEL).then((level: string) => {
                    if (LogsService.isValidLevel(level)) {
                        LogsService.setGlobalLevel(level as ELogLevels);
                    } else if (this._production) {
                        LogsService.setGlobalLevel(ELogLevels.ERROR);
                    } else {
                        LogsService.setGlobalLevel(ELogLevels.ENV);
                    }
                    resolve();
                }).catch((error: Error) => {
                    LogsService.setGlobalLevel(ELogLevels.ERROR);
                    this._logger.warn(`Fail to get value for ${CDEV_LOG_LEVEL} due error: ${error.message}`);
                    resolve();
                });
            }).catch((error: Error) => {
                this._logger.warn(`Fail to get value for ${CDEV_ENV_VAR} due error: ${error.message}`);
                resolve();
            });
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
