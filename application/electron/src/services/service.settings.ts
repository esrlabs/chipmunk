import * as IScheme from './service.settings.scheme';

import { StateFile } from '../classes/class.statefile';

const SETTINGS_FILE = 'config.application.json';

/**
 * @class ServiceConfig
 * @description Provides access to logviewer configuration. Used on electron level
 */

class ServiceConfig extends StateFile<IScheme.ISettings> {

    constructor() {
        super('ServiceConfig', IScheme.defaults, SETTINGS_FILE);
    }

}

export default (new ServiceConfig());
