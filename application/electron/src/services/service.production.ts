import Logger from '../tools/env.logger';
import { getEnvVar } from 'logviewer.shell.env';
import { IService } from '../interfaces/interface.service';

const CDEV_ENV_VAR = 'CHIPMUNK_DEVELOPING_MODE';
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
        return new Promise((resolve, reject) => {
            getEnvVar(CDEV_ENV_VAR).then((value: string) => {
                if (value === CDEV_ENV_VAR_VALUE) {
                    this._production = false;
                }
                this._logger.env(`Production is: ${this._production ? 'ON' : 'OFF'}`);
                resolve();
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
