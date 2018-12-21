import * as IScheme from './service.window.state.scheme';

import { ClassServiceFileState } from '../src/interfaces/class.service.filestate';

const SETTINGS_FILE = 'config.window.json';

/**
 * @class ServiceConfig
 * @description Provides access to logviewer configuration. Used on electron level
 */

class ServiceWindowState extends ClassServiceFileState<IScheme.IWindowState> {

    constructor() {
        super('ServiceWindowState', IScheme.defaults, SETTINGS_FILE);
    }

}

export default (new ServiceWindowState());
