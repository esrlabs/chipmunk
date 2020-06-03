import Logger from '../tools/env.logger';
import { getEnvVar } from 'chipmunk.shell.env';

import { IService } from '../interfaces/interface.service';
// TODO:
// add addition env var to avoid DevTools in browser

export enum EChipmunkEnvVars {
    /**
     * ON - activate developing mode:
     * - all plugins processes will be started with debug-listener
     * - browser will be started with devtools
     */
    CHIPMUNK_DEVELOPING_MODE = 'CHIPMUNK_DEVELOPING_MODE',

    /**
     * ON - activate webtools in developing mode
     * OFF - deactivate webtools in developing mode
     */
    CHIPMUNK_NO_WEBDEVTOOLS = 'CHIPMUNK_NO_WEBDEVTOOLS',

    /**
     * Definition of log level:
     * - INFO (I, IN),
     * - DEBUG (D, DEB),
     * - WARNING (W, WAR, WARN),
     * - VERBOS (V, VER, VERBOSE),
     * - ERROR (E, ERR),
     * - ENV - ENV logs never writes into logs file; it's just shown in stdout,
     * - WTF - WTF logs useful for debuggin. If at least one WTF log was sent, only WTF logs will be shown. This logs never writes into logs file,
     */
    CHIPMUNK_DEV_LOGLEVEL = 'CHIPMUNK_DEV_LOGLEVEL',

    /**
     * TRUE (true, ON, on) - prevent recording render's logs into backend
     */
    CHIPMUNK_NO_RENDER_LOGS = 'CHIPMUNK_NO_RENDER_LOGS',

    /**
     * Path to custom plugins folder
     */
    CHIPMUNK_PLUGINS_SANDBOX = 'CHIPMUNK_PLUGINS_SANDBOX',

    /**
     * TRUE (true, ON, on) - prevent downloading of defaults plugins
     */
    CHIPMUNK_PLUGINS_NO_DEFAULTS = 'CHIPMUNK_PLUGINS_NO_DEFAULTS',

    /**
     * TRUE (true, ON, on) - prevent upgrade plugins
     */
    CHIPMUNK_PLUGINS_NO_UPGRADE = 'CHIPMUNK_PLUGINS_NO_UPGRADE',

    /**
     * TRUE (true, ON, on) - prevent update plugins workflow
     */
    CHIPMUNK_PLUGINS_NO_UPDATES = 'CHIPMUNK_PLUGINS_NO_UPDATES',

    /**
     * TRUE (true, ON, on) - prevent removing not valid plugins
     */
    CHIPMUNK_PLUGINS_NO_REMOVE_NOTVALID = 'CHIPMUNK_PLUGINS_NO_REMOVE_NOTVALID',
}

export const CChipmunkEnvVars: string[] = [
    EChipmunkEnvVars.CHIPMUNK_DEVELOPING_MODE,
    EChipmunkEnvVars.CHIPMUNK_DEV_LOGLEVEL,
    EChipmunkEnvVars.CHIPMUNK_NO_RENDER_LOGS,
    EChipmunkEnvVars.CHIPMUNK_PLUGINS_SANDBOX,
    EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_DEFAULTS,
    EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_UPDATES,
    EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_UPGRADE,
    EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_REMOVE_NOTVALID,
];

export interface IChipmunkEnvVars {
    CHIPMUNK_DEVELOPING_MODE: string | undefined;
    CHIPMUNK_NO_WEBDEVTOOLS: boolean | undefined;
    CHIPMUNK_NO_RENDER_LOGS: boolean | undefined;
    CHIPMUNK_DEV_LOGLEVEL: string | undefined;
    CHIPMUNK_PLUGINS_SANDBOX: string | undefined;
    CHIPMUNK_PLUGINS_NO_DEFAULTS: boolean | undefined;
    CHIPMUNK_PLUGINS_NO_UPDATES: boolean | undefined;
    CHIPMUNK_PLUGINS_NO_UPGRADE: boolean | undefined;
    CHIPMUNK_PLUGINS_NO_REMOVE_NOTVALID: boolean | undefined;
}

const CChipmunkEnvVarsParsers: { [key: string]: (smth: any) => boolean } = {
    [EChipmunkEnvVars.CHIPMUNK_NO_WEBDEVTOOLS]: (smth: any): boolean => {
        if (typeof smth === 'string' && ['true', 'on', '1'].indexOf(smth.toLowerCase().trim()) !== -1) {
            return true;
        }
        if (typeof smth === 'number' && smth === 1) {
            return true;
        }
        return false;
    },
    [EChipmunkEnvVars.CHIPMUNK_NO_RENDER_LOGS]: (smth: any): boolean => {
        if (typeof smth === 'string' && ['true', 'on', '1'].indexOf(smth.toLowerCase().trim()) !== -1) {
            return true;
        }
        if (typeof smth === 'number' && smth === 1) {
            return true;
        }
        return false;
    },
    [EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_DEFAULTS]: (smth: any): boolean => {
        if (typeof smth === 'string' && ['true', 'on', '1'].indexOf(smth.toLowerCase().trim()) !== -1) {
            return true;
        }
        if (typeof smth === 'number' && smth === 1) {
            return true;
        }
        return false;
    },
    [EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_UPDATES]: (smth: any): boolean => {
        if (typeof smth === 'string' && ['true', 'on', '1'].indexOf(smth.toLowerCase().trim()) !== -1) {
            return true;
        }
        if (typeof smth === 'number' && smth === 1) {
            return true;
        }
        return false;
    },
    [EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_UPGRADE]: (smth: any): boolean => {
        if (typeof smth === 'string' && ['true', 'on', '1'].indexOf(smth.toLowerCase().trim()) !== -1) {
            return true;
        }
        if (typeof smth === 'number' && smth === 1) {
            return true;
        }
        return false;
    },
    [EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_REMOVE_NOTVALID]: (smth: any): boolean => {
        if (typeof smth === 'string' && ['true', 'on', '1'].indexOf(smth.toLowerCase().trim()) !== -1) {
            return true;
        }
        if (typeof smth === 'number' && smth === 1) {
            return true;
        }
        return false;
    },
};

/**
 * @class ServiceEnv
 * @description Detects OS env
 */

class ServiceEnv implements IService {

    private _logger: Logger = new Logger('ServiceEnv');
    private _env: IChipmunkEnvVars = {
        CHIPMUNK_DEVELOPING_MODE: undefined,
        CHIPMUNK_NO_WEBDEVTOOLS: undefined,
        CHIPMUNK_DEV_LOGLEVEL: undefined,
        CHIPMUNK_NO_RENDER_LOGS: undefined,
        CHIPMUNK_PLUGINS_SANDBOX: undefined,
        CHIPMUNK_PLUGINS_NO_DEFAULTS: undefined,
        CHIPMUNK_PLUGINS_NO_UPDATES: undefined,
        CHIPMUNK_PLUGINS_NO_UPGRADE: undefined,
        CHIPMUNK_PLUGINS_NO_REMOVE_NOTVALID: undefined,
    };

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const list = [
                EChipmunkEnvVars.CHIPMUNK_DEVELOPING_MODE,
                EChipmunkEnvVars.CHIPMUNK_NO_WEBDEVTOOLS,
                EChipmunkEnvVars.CHIPMUNK_DEV_LOGLEVEL,
                EChipmunkEnvVars.CHIPMUNK_NO_RENDER_LOGS,
                EChipmunkEnvVars.CHIPMUNK_PLUGINS_SANDBOX,
                EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_DEFAULTS,
                EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_UPDATES,
                EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_REMOVE_NOTVALID,
            ];
            Promise.all(list.map((env: string) => {
                return getEnvVar(env).then((value: string) => {
                    if (typeof value !== 'string' || value.trim() === '') {
                        (this._env as any)[env] = undefined;
                    } else {
                        if (CChipmunkEnvVarsParsers[env] !== undefined) {
                            (this._env as any)[env] = CChipmunkEnvVarsParsers[env](value);
                        } else {
                            (this._env as any)[env] = value;
                        }
                    }
                });
            })).then(() => {
                this._logger.debug(`Next env vars are detected:\n${list.map((env: string) => {
                    return `\t${env}=${(this._env as any)[env]}`;
                }).join('\n')}`);
                resolve();
            }).catch((error: Error) => {
                reject(new Error(this._logger.error(`Fail to detect OS env due error: ${error.message}`)));
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
