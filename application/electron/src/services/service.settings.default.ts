// tslint:disable: max-classes-per-file

import { IService } from '../interfaces/interface.service';
import { Entry, ESettingType } from '../../../common/settings/field';
import { CoreIndex } from './settings.defaults/settings.core.index';
import { GeneralUpdateApp } from './settings.defaults/settings.general.update.app';
import { GeneralUpdatePlugins } from './settings.defaults/settings.general.update.plugins';

import ServiceSettings from './service.settings';

export const CSettings = {
    client: {
        index: new CoreIndex({ key: 'index', name: 'index', desc: 'HTML Index file', path: 'core', type: ESettingType.hidden }),
    },
    general: {
        update: {
            app: new GeneralUpdateApp({ key: 'app', name: 'Application', desc: 'Automatically check for application updates', path: 'general.update', type: ESettingType.standard }),
            plugins: new GeneralUpdatePlugins({ key: 'plugins', name: 'Plugins', desc: 'Automatically check for plugins updates', path: 'general.update', type: ESettingType.standard }),
        },
    },
};

/**
 * @class ServiceConfigDefault
 * @description Setup default settings
 */

class ServiceConfigDefault implements IService {

    public init(): Promise<void> {
        return new Promise((resolve) => {
            ServiceSettings.register(new Entry({ key: 'core', name: 'Core', desc: 'Settings of core', path: '', type: ESettingType.hidden }));
            ServiceSettings.register(CSettings.client.index);
            ServiceSettings.register(new Entry({ key: 'general', name: 'Core', desc: 'General setting of chipmunk', path: '', type: ESettingType.standard }));
            ServiceSettings.register(new Entry({ key: 'update', name: 'Update', desc: 'Configure update workflow', path: 'general', type: ESettingType.standard }));
            ServiceSettings.register(CSettings.general.update.app);
            ServiceSettings.register(CSettings.general.update.plugins);
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceConfigDefault';
    }

}

export default (new ServiceConfigDefault());
