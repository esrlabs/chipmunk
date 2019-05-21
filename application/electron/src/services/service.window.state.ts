import * as IScheme from './service.window.state.scheme';

import { StateFile } from '../classes/class.statefile';

const SETTINGS_FILE = 'config.window.json';

/**
 * @class ServiceWindowState
 * @description Controls browser window state
 */

class ServiceWindowState extends StateFile<IScheme.IWindowState> {

    constructor() {
        super('ServiceWindowState', IScheme.defaults, SETTINGS_FILE);
    }

}

export default (new ServiceWindowState());
