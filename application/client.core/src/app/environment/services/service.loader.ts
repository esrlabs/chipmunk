import ServiceElectronIpc from './service.electron.ipc';
import PluginsIPCService from './service.plugins.ipc';
import PluginsService from './service.plugins';
import SessionsService from './service.sessions';

import * as Tools from '../tools/index';

const InitializeStages = [
    // Stage #1
    [ServiceElectronIpc],
    // Stage #2
    [PluginsService],
    // Stage #3
    [SessionsService, PluginsIPCService],
];

export class LoaderService {

    private _logger: Tools.Logger = new Tools.Logger('PluginsLoader');

    /**
     * Initialization of application
     * Will start application in case of success of initialization
     * @returns void
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._init(0, (error?: Error) => {
                if (error instanceof Error) {
                    return reject(error);
                }
                resolve();
            });
        });
    }

    private _init(stage: number = 0, callback: (error?: Error) => any): void {
        if (InitializeStages.length <= stage) {
            this._logger.env(`Application is initialized`);
            typeof callback === 'function' && callback();
            return;
        }
        this._logger.env(`Application initialization: stage #${stage + 1}: starting...`);
        const services: any[] = InitializeStages[stage];
        const tasks: Array<Promise<any>> = services.map((ref: any) => {
            this._logger.env(`Init: ${ref.getName()}`);
            return ref.init();
        });
        if (tasks.length === 0) {
            return this._init(stage + 1, callback);
        }
        Promise.all(tasks).then(() => {
            this._logger.env(`Application initialization: stage #${stage + 1}: OK`);
            this._init(stage + 1, callback);
        }).catch((error: Error) => {
            this._logger.env(`Fail to initialize application dure error: ${error.message}`);
            callback(error);
        });
    }

}

export default (new LoaderService());
