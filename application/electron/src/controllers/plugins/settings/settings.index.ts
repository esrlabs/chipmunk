// tslint:disable: max-classes-per-file

import { Entry, ESettingType } from '../../../../../common/settings/field.store';
import { sequences } from '../../../tools/sequences';
import { StandardBoolean } from '../../settings/settings.standard.boolean';

import ServiceSettings from '../../../services/service.settings';
import Logger from '../../../tools/env.logger';

export enum CSettingsAliases {
    PluginsUpdates = 'PluginsUpdates',
    PluginsUpgrades = 'PluginsUpgrades',
    RemoveNotValid = 'RemoveNotValid',
    DefaultsPlugins = 'DefaultsPlugins',
}

export const CSettingsEtries = {
    [CSettingsAliases.PluginsUpdates]: new StandardBoolean({
        key: CSettingsAliases.PluginsUpdates,
        name: 'Update automatically',
        desc: 'Update plugins automatically if update is available',
        path: 'general.plugins',
        type: ESettingType.standard },
        CSettingsAliases.PluginsUpdates,
    ),
    [CSettingsAliases.PluginsUpgrades]: new StandardBoolean({
        key: CSettingsAliases.PluginsUpgrades,
        name: 'Upgrade automatically',
        desc: 'Upgrade plugins automatically if plugin requires upgrade',
        path: 'general.plugins',
        type: ESettingType.advanced },
        CSettingsAliases.PluginsUpgrades,
    ),
    [CSettingsAliases.RemoveNotValid]: new StandardBoolean({
        key: CSettingsAliases.RemoveNotValid,
        name: 'Remove not valid',
        desc: `Remove (uninstall) plugin if installed version of plugin doesn't work correct.`,
        path: 'general.plugins',
        type: ESettingType.advanced },
        CSettingsAliases.RemoveNotValid,
    ),
    [CSettingsAliases.DefaultsPlugins]: new StandardBoolean({
        key: CSettingsAliases.DefaultsPlugins,
        name: 'Auto install defaults',
        desc: 'Find and install automatically all defaults plugins',
        path: 'general.plugins',
        type: ESettingType.advanced },
        CSettingsAliases.DefaultsPlugins,
    ),
};

export function registerPluginsManagerSettings(): Promise<void> {
    return new Promise((resolve, reject) => {
        const logger: Logger = new Logger('registerPluginsManagerSettings');
        sequences([
            ServiceSettings.register.bind(ServiceSettings, new Entry({ key: 'general', name: 'General', desc: 'General setting of chipmunk', path: '', type: ESettingType.standard })),
            ServiceSettings.register.bind(ServiceSettings, new Entry({ key: 'plugins', name: 'Plugins Manager', desc: 'Configure plugins manager settings', path: 'general', type: ESettingType.standard })),
        ]).then(() => {
            Promise.all([
                ServiceSettings.register(CSettingsEtries.PluginsUpdates).catch((regErr: Error) => {
                    logger.error(regErr.message);
                }),
                ServiceSettings.register(CSettingsEtries.PluginsUpgrades).catch((regErr: Error) => {
                    logger.error(regErr.message);
                }),
                ServiceSettings.register(CSettingsEtries.DefaultsPlugins).catch((regErr: Error) => {
                    logger.error(regErr.message);
                }),
                ServiceSettings.register(CSettingsEtries.RemoveNotValid).catch((regErr: Error) => {
                    logger.error(regErr.message);
                }),
            ]).then(() => {
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        }).catch((structErr: Error) => {
            reject(structErr);
        });
    });
}
