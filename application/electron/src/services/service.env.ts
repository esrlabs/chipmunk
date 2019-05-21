import * as util from 'util';
import { getShellEnvironment } from '../tools/process.env';
import Logger from '../tools/env.logger';

import { IService } from '../interfaces/interface.service';

/**
 * @class ServiceEnv
 * @description Detects OS env
 */

class ServiceEnv implements IService {

    private _logger: Logger = new Logger('ServiceEnv');
    private _env: { [key: string]: any } = { };

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            getShellEnvironment().then((env: { [key: string]: any }) => {
                this._env = env;
                this._logger.env(`OS Env are detected: ${util.inspect(env)}`);
                resolve();
            }).catch((error: Error) => {
                reject(this._logger.error(`Fail to detect OS env due error: ${error.message}`));
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceEnv';
    }

}

export default (new ServiceEnv());
