import { getEnvVar, getElectronAppShellEnvVars } from '@env/os';
import { setProp, getProp } from 'platform/env/obj';

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
    CHIPMUNK_DEVELOPING_MODE: boolean | undefined;
    CHIPMUNK_NO_WEBDEVTOOLS: boolean | undefined;
    CHIPMUNK_NO_RENDER_LOGS: boolean | undefined;
    CHIPMUNK_DEV_LOGLEVEL: string | undefined;
    CHIPMUNK_PLUGINS_SANDBOX: string | undefined;
    CHIPMUNK_PLUGINS_NO_DEFAULTS: boolean | undefined;
    CHIPMUNK_PLUGINS_NO_UPDATES: boolean | undefined;
    CHIPMUNK_PLUGINS_NO_UPGRADE: boolean | undefined;
    CHIPMUNK_PLUGINS_NO_REMOVE_NOTVALID: boolean | undefined;
}

const CChipmunkEnvVarsParsers: { [key: string]: (smth: unknown) => boolean } = {
    [EChipmunkEnvVars.CHIPMUNK_DEVELOPING_MODE]: (smth: unknown): boolean => {
        if (
            typeof smth === 'string' &&
            ['true', 'on', '1'].indexOf(smth.toLowerCase().trim()) !== -1
        ) {
            return true;
        }
        if (typeof smth === 'number' && smth === 1) {
            return true;
        }
        return false;
    },
    [EChipmunkEnvVars.CHIPMUNK_NO_WEBDEVTOOLS]: (smth: unknown): boolean => {
        if (
            typeof smth === 'string' &&
            ['true', 'on', '1'].indexOf(smth.toLowerCase().trim()) !== -1
        ) {
            return true;
        }
        if (typeof smth === 'number' && smth === 1) {
            return true;
        }
        return false;
    },
    [EChipmunkEnvVars.CHIPMUNK_NO_RENDER_LOGS]: (smth: unknown): boolean => {
        if (
            typeof smth === 'string' &&
            ['true', 'on', '1'].indexOf(smth.toLowerCase().trim()) !== -1
        ) {
            return true;
        }
        if (typeof smth === 'number' && smth === 1) {
            return true;
        }
        return false;
    },
    [EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_DEFAULTS]: (smth: unknown): boolean => {
        if (
            typeof smth === 'string' &&
            ['true', 'on', '1'].indexOf(smth.toLowerCase().trim()) !== -1
        ) {
            return true;
        }
        if (typeof smth === 'number' && smth === 1) {
            return true;
        }
        return false;
    },
    [EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_UPDATES]: (smth: unknown): boolean => {
        if (
            typeof smth === 'string' &&
            ['true', 'on', '1'].indexOf(smth.toLowerCase().trim()) !== -1
        ) {
            return true;
        }
        if (typeof smth === 'number' && smth === 1) {
            return true;
        }
        return false;
    },
    [EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_UPGRADE]: (smth: unknown): boolean => {
        if (
            typeof smth === 'string' &&
            ['true', 'on', '1'].indexOf(smth.toLowerCase().trim()) !== -1
        ) {
            return true;
        }
        if (typeof smth === 'number' && smth === 1) {
            return true;
        }
        return false;
    },
    [EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_REMOVE_NOTVALID]: (smth: unknown): boolean => {
        if (
            typeof smth === 'string' &&
            ['true', 'on', '1'].indexOf(smth.toLowerCase().trim()) !== -1
        ) {
            return true;
        }
        if (typeof smth === 'number' && smth === 1) {
            return true;
        }
        return false;
    },
};

const GeneralEnvVarsList = [
    EChipmunkEnvVars.CHIPMUNK_DEVELOPING_MODE,
    EChipmunkEnvVars.CHIPMUNK_NO_WEBDEVTOOLS,
    EChipmunkEnvVars.CHIPMUNK_DEV_LOGLEVEL,
    EChipmunkEnvVars.CHIPMUNK_NO_RENDER_LOGS,
    EChipmunkEnvVars.CHIPMUNK_PLUGINS_SANDBOX,
    EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_DEFAULTS,
    EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_UPDATES,
    EChipmunkEnvVars.CHIPMUNK_PLUGINS_NO_REMOVE_NOTVALID,
];

export class GeneralEnvVars {
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
    private _os: typeof process.env = process.env;

    public init(): Promise<void> {
        return new Promise((resolve) => {
            Promise.all(
                GeneralEnvVarsList.map((env: string) => {
                    return getEnvVar(env)
                        .then((value: string) => {
                            if (typeof value !== 'string' || value.trim() === '') {
                                setProp(this._env, env, undefined);
                            } else {
                                if (CChipmunkEnvVarsParsers[env] !== undefined) {
                                    setProp(this._env, env, CChipmunkEnvVarsParsers[env](value));
                                } else {
                                    setProp(this._env, env, value);
                                }
                            }
                        })
                        .catch((err: Error) => {
                            console.error(
                                `Cannot detect env "${env}" due error: ${
                                    err instanceof Error ? err.message : err
                                }`,
                            );
                            setProp(this._env, env, undefined);
                        });
                }),
            )
                .catch((error: Error) => {
                    // Drop all to default
                    GeneralEnvVarsList.forEach((env: string) => {
                        setProp(this._env, env, undefined);
                    });
                    console.error(`Fail to detect OS env due error: ${error.message}`);
                })
                .finally(() => {
                    getElectronAppShellEnvVars(process.execPath)
                        .then((vars) => {
                            this._os = vars;
                        })
                        .catch((err: Error) => {
                            console.error(
                                `Fail get all envvars due error: ${
                                    err instanceof Error ? err.message : err
                                }`,
                            );
                        })
                        .finally(resolve);
                });
        });
    }

    public get(): IChipmunkEnvVars {
        return Object.assign({}, this._env);
    }

    public getOS(): typeof process.env {
        return this._os;
    }

    public envsToString(): string {
        return `Next env vars are detected:\n${GeneralEnvVarsList.map((env: string) => {
            return `\t${env}=${getProp(this._env, env)}`;
        }).join('\n')}`;
    }
}

export const envvars = new GeneralEnvVars();
