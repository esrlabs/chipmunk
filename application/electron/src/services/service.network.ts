import * as FS from '../tools/fs';

import Logger from '../tools/env.logger';
import ServiceSettings from './service.settings';

import { IService } from '../interfaces/interface.service';
import { StandardInput } from '../controllers/settings/settings.standard.input';
import { StandardBoolean } from '../controllers/settings/settings.standard.boolean';
import { Entry, ESettingType } from '../../../common/settings/field.store';
import { sequences } from '../tools/sequences';

export enum CSettingsAliases {
    NetworkProxySettings = 'NetworkProxySettings',
    NetworkProxyAuthorization = 'NetworkProxyAuthorization',
    NetworkStrictSSL = 'NetworkStrictSSL',
}

export const CSettingsEtries = {
    [CSettingsAliases.NetworkProxySettings]: new StandardInput({
        key: CSettingsAliases.NetworkProxySettings,
        name: 'Proxy',
        desc: 'Default values would be taken from the http_proxy and https_proxy environment variables.',
        path: 'general.network',
        type: ESettingType.standard },
        CSettingsAliases.NetworkProxySettings,
    ),
    [CSettingsAliases.NetworkProxyAuthorization]: new StandardInput({
        key: CSettingsAliases.NetworkProxyAuthorization,
        name: 'Proxy-Authorization',
        desc: 'The value to send as the Proxy-Authorization header for every network request.',
        path: 'general.network',
        type: ESettingType.standard },
        CSettingsAliases.NetworkProxyAuthorization,
    ),
    [CSettingsAliases.NetworkStrictSSL]: new StandardBoolean({
        key: CSettingsAliases.NetworkStrictSSL,
        name: 'Proxy Strict SSL',
        desc: 'Controls whether the proxy server certificate should be verified against the list of supplied CAs',
        path: 'general.network',
        type: ESettingType.standard },
        CSettingsAliases.NetworkStrictSSL,
    ),
};

export const CSettingsDefaults = {
    [CSettingsAliases.NetworkProxySettings]: () => {
        return '';
    },
    [CSettingsAliases.NetworkProxyAuthorization]: () => {
        return '';
    },
    [CSettingsAliases.NetworkStrictSSL]: () => {
        return true;
    },
};


/**
 * @class ServiceNetwork
 */

class ServiceNetwork implements IService {

    private _logger: Logger = new Logger('ServiceNetwork');
    private _settings: {
        [CSettingsAliases.NetworkProxySettings]: string,
        [CSettingsAliases.NetworkProxyAuthorization]: string,
        [CSettingsAliases.NetworkStrictSSL]: boolean,
    } = {
        [CSettingsAliases.NetworkProxySettings]: '',
        [CSettingsAliases.NetworkProxyAuthorization]: '',
        [CSettingsAliases.NetworkStrictSSL]: true,
    };
    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._setSettings().catch((err: Error) => {
                this._logger.error(`Fail to register settings due error: ${err.message}`);
            }).finally(() => {
                this._getSettings();
                resolve();
            });
        });
    }

    public destroy(): Promise<void> {
        return Promise.resolve();
    }

    public getName(): string {
        return 'ServiceNetwork';
    }

    /**
     * Returns current proxy settings
     * @returns {
     *      proxy: string | undefined,
     *      auth: string | undefined,
     *      strictSSL: boolean,
     * }
     */
    public getSettings(): {
        proxy: string | undefined,
        auth: string | undefined,
        strictSSL: boolean,
    } {
        return {
            proxy: this._settings[CSettingsAliases.NetworkProxySettings].trim() === '' ? undefined : this._settings[CSettingsAliases.NetworkProxySettings],
            auth: this._settings[CSettingsAliases.NetworkProxyAuthorization].trim() === '' ? undefined : this._settings[CSettingsAliases.NetworkProxyAuthorization],
            strictSSL: this._settings[CSettingsAliases.NetworkStrictSSL],
        };
    }

    private _setSettings(): Promise<void> {
        return new Promise((resolve, reject) => {
            sequences([
                ServiceSettings.register.bind(ServiceSettings, new Entry({ key: 'general', name: 'General', desc: 'General setting of chipmunk', path: '', type: ESettingType.standard })),
                ServiceSettings.register.bind(ServiceSettings, new Entry({ key: 'network', name: 'Network', desc: 'Application network settings', path: 'general', type: ESettingType.standard })),
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

    private _getSettings() {
        [   CSettingsAliases.NetworkProxySettings,
            CSettingsAliases.NetworkProxyAuthorization,
            CSettingsAliases.NetworkStrictSSL,
        ].forEach((alias: CSettingsAliases) => {
            const setting: string | boolean | Error = ServiceSettings.get<string | boolean>(CSettingsEtries[alias].getFullPath());
            if (setting instanceof Error) {
                this._logger.warn(`Fail to load settings "${CSettingsEtries[alias].getFullPath()}" due error: ${setting.message}`);
            } else {
                (this._settings as any)[alias] = setting;
            }
        });
        this._logger.debug(`Network settings to be used: ${Object.keys(this._settings).map((key: string) => {
            return `\n\t- ${key}: ${(this._settings as any)[key]}`;
        }).join('')}`);
    }

}

export default (new ServiceNetwork());
