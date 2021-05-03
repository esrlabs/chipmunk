import * as FS from '../tools/fs';

import Logger from '../tools/env.logger';
import ServiceSettings from './service.settings';
import ServicePaths from '../services/service.paths';

import { IService } from '../interfaces/interface.service';
import { StandardInput } from '../controllers/settings/settings.standard.input';
import { Entry, ESettingType } from '../../../common/settings/field.store';
import { sequences } from '../tools/sequences';

export enum CSettingsAliases {
    ApplicationSocketsFolder = 'ApplicationSocketsFolder',
    ApplicationStreamFolder = 'ApplicationStreamFolder',
}

export const CSettingsEtries = {
    [CSettingsAliases.ApplicationSocketsFolder]: new StandardInput({
        key: CSettingsAliases.ApplicationSocketsFolder,
        name: 'Sockets folder',
        desc: 'Destination folder to store file-sockets (used for plugins communication)',
        path: 'general.paths',
        type: ESettingType.advanced },
        CSettingsAliases.ApplicationSocketsFolder,
    ),
    [CSettingsAliases.ApplicationStreamFolder]: new StandardInput({
        key: CSettingsAliases.ApplicationStreamFolder,
        name: 'Indexed files folder',
        desc: 'Destination folder to store indexed files/streams',
        path: 'general.paths',
        type: ESettingType.standard },
        CSettingsAliases.ApplicationStreamFolder,
    ),
};

export const CSettingsDefaults = {
    [CSettingsAliases.ApplicationSocketsFolder]: () => {
        return ServicePaths.getSockets();
    },
    [CSettingsAliases.ApplicationStreamFolder]: () => {
        return ServicePaths.getStreams();
    },
};


/**
 * @class ServiceUserPaths
 * @description Gives customized by user paths
 */

class ServiceUserPaths implements IService {

    private _logger: Logger = new Logger('ServiceUserPaths');
    private _settings: {
        [CSettingsAliases.ApplicationSocketsFolder]: string,
        [CSettingsAliases.ApplicationStreamFolder]: string,
    } = {
        [CSettingsAliases.ApplicationSocketsFolder]: '',
        [CSettingsAliases.ApplicationStreamFolder]: '',
    };
    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._settings[CSettingsAliases.ApplicationStreamFolder] = ServicePaths.getStreams();
            this._settings[CSettingsAliases.ApplicationSocketsFolder] = ServicePaths.getSockets();
            this._setSettings().catch((err: Error) => {
                this._logger.error(`Fail to register settings due error: ${err.message}`);
            }).finally(() => {
                this._getSettings().catch((err: Error) => {
                    this._logger.error(`Fail to load settings due error: ${err.message}`);
                }).finally(() => {
                    resolve(undefined);
                });
            });
        });
    }

    public destroy(): Promise<void> {
        return Promise.resolve();
    }

    public getName(): string {
        return 'ServiceUserPaths';
    }

    /**
     * Returns path to sockets folder
     * @returns string
     */
    public getSockets(): string {
        return this._settings[CSettingsAliases.ApplicationSocketsFolder];
    }

    /**
     * Returns path to streams folder
     * @returns string
     */
    public getStreams(): string {
        return this._settings[CSettingsAliases.ApplicationStreamFolder];
    }

    private _setSettings(): Promise<void> {
        return new Promise((resolve, reject) => {
            sequences([
                ServiceSettings.register.bind(ServiceSettings, new Entry({ key: 'general', name: 'General', desc: 'General setting of chipmunk', path: '', type: ESettingType.standard })),
                ServiceSettings.register.bind(ServiceSettings, new Entry({ key: 'paths', name: 'Paths', desc: 'Application paths (changes will effect after restart)', path: 'general', type: ESettingType.standard })),
            ]).then(() => {
                Promise.all(Object.keys(CSettingsEtries).map((key: string) => {
                    return ServiceSettings.register((CSettingsEtries as any)[key]).catch((regErr: Error) => {
                        this._logger.error(`Problems with registering "${key}": ${regErr.message}`);
                    });
                })).then(() => {
                    resolve();
                }).catch((error: Error) => {
                    reject(error);
                });
            }).catch((structErr: Error) => {
                reject(structErr);
            });
        });
    }

    private _getSettings(): Promise<void> {
        return new Promise((resolve) => {
            [   CSettingsAliases.ApplicationSocketsFolder,
                CSettingsAliases.ApplicationStreamFolder,
            ].forEach((alias: CSettingsAliases) => {
                const setting: string | Error = ServiceSettings.get<string>(CSettingsEtries[alias].getFullPath());
                if (setting instanceof Error) {
                    this._logger.warn(`Fail to load settings "${CSettingsEtries[alias].getFullPath()}" due error: ${setting.message}`);
                } else {
                    this._settings[alias] = setting;
                }
            });
            Promise.all(Object.keys(this._settings).map((key: string) => {
                return new Promise((res) => {
                    if (typeof (this._settings as any)[key] !== 'string' || (this._settings as any)[key].trim() === '') {
                        (this._settings as any)[key] = (CSettingsDefaults as any)[key]();
                        (CSettingsEtries as any)[key].set((this._settings as any)[key]).catch((err: Error) => {
                            this._logger.warn(`Fail to set ${key} with value "${(this._settings as any)[key]}" due error: ${err.message}`);
                        }).finally(res);
                    } else {
                        res(undefined);
                    }
                });
            })).catch((err: Error) => {
                this._logger.warn(`Fail to check settings due error: ${err.message}`);
            }).finally(() => {
                Promise.all(Object.keys(this._settings).map((key: string) => {
                    return new Promise((res) => {
                        let dropToDefault: boolean = false;
                        FS.exist((this._settings as any)[key]).then((value: boolean) => {
                            if (!value) {
                                dropToDefault = true;
                            }
                        }).catch((err: Error) => {
                            dropToDefault = true;
                            this._logger.warn(`Fail to check ${key} with value "${(this._settings as any)[key]}" due error: ${err.message}`);
                        }).finally(() => {
                            if (dropToDefault) {
                                (this._settings as any)[key] = (CSettingsDefaults as any)[key]();
                                (CSettingsEtries as any)[key].set((this._settings as any)[key]).catch((err: Error) => {
                                    this._logger.warn(`Fail to set ${key} with value "${(this._settings as any)[key]}" due error: ${err.message}`);
                                }).finally(res);
                            } else {
                                res(undefined);
                            }
                        });
                    });
                })).catch((err: Error) => {
                    this._logger.warn(`Fail to validate settings due error: ${err.message}`);
                }).finally(() => {
                    resolve(undefined);
                });
            });
        });

    }

}

export default (new ServiceUserPaths());
