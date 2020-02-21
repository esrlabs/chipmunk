import Logger from '../tools/env.logger';
import { getEnvVar } from 'chipmunk.shell.env';

import { IService } from '../interfaces/interface.service';

export enum EChipmunkEnvVars {
    CHIPMUNK_DEVELOPING_MODE = 'CHIPMUNK_DEVELOPING_MODE',
    CHIPMUNK_DEV_LOGLEVEL = 'CHIPMUNK_DEV_LOGLEVEL',
    CHIPMUNK_PLUGINS_SANDBOX = 'CHIPMUNK_PLUGINS_SANDBOX',
}

export const CChipmunkEnvVars: string[] = [
    EChipmunkEnvVars.CHIPMUNK_DEVELOPING_MODE,
    EChipmunkEnvVars.CHIPMUNK_DEV_LOGLEVEL,
    EChipmunkEnvVars.CHIPMUNK_PLUGINS_SANDBOX,
];

export interface IChipmunkEnvVars {
    CHIPMUNK_DEVELOPING_MODE: string | undefined;
    CHIPMUNK_DEV_LOGLEVEL: string | undefined;
    CHIPMUNK_PLUGINS_SANDBOX: string | undefined;
}

/**
 * @class ServiceEnv
 * @description Detects OS env
 */

class ServiceEnv implements IService {

    private _logger: Logger = new Logger('ServiceEnv');
    private _env: IChipmunkEnvVars = {
        CHIPMUNK_DEVELOPING_MODE: undefined,
        CHIPMUNK_DEV_LOGLEVEL: undefined,
        CHIPMUNK_PLUGINS_SANDBOX: undefined,
    };

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const list = [
                EChipmunkEnvVars.CHIPMUNK_DEVELOPING_MODE,
                EChipmunkEnvVars.CHIPMUNK_DEV_LOGLEVEL,
                EChipmunkEnvVars.CHIPMUNK_PLUGINS_SANDBOX,
            ];
            Promise.all(list.map((env: string) => {
                return getEnvVar(env).then((value: string) => {
                    if (typeof value !== 'string' || value.trim() === '') {
                        (this._env as any)[env] = undefined;
                    } else {
                        (this._env as any)[env] = value;
                    }
                });
            })).then(() => {
                this._logger.debug(`Next env vars are detected:\n${list.map((env: string) => {
                    return `\t${env}=${(this._env as any)[env]}`;
                }).join('\n')}`);
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

    public get(): IChipmunkEnvVars {
        return Object.assign({}, this._env);
    }

}

export default (new ServiceEnv());
