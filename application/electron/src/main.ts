// Libs
import Logger from '../platform/node/src/env.logger';

// Services
import ServiceElectron from './services/service.electron';
import ServicePackage from './services/service.package';
import ServicePaths from './services/service.paths';
import ServiceSettings from './services/service.settings';
import ServiceWindowState from './services/service.window.state';

const InitializeStages = [
    // Stage #1
    [ServicePaths],
    // Stage #2
    [ServiceSettings, ServiceWindowState, ServicePackage],
    // Stage #3 (last service should startup service and should be single always)
    [ServiceElectron],
];

class Application {

    private _logger: Logger = new Logger('Application');

    /**
     * Initialization of application
     * Will start application in case of success of initialization
     * @returns void
     */
    public init(stage: number = 0): void {
        if (InitializeStages.length <= stage) {
            this._logger.env(`Application is initialized`);
        }
        this._logger.env(`Application initialization: stage #${stage + 1}: starting...`);
        const services: any[] = InitializeStages[stage];
        const tasks: Array<Promise<any>> = services.map((ref: any) => {
            this._logger.env(`Init: ${ref.getName()}`);
            return ref.init();
        });
        if (tasks.length === 0) {
            return this.init(stage + 1);
        }
        Promise.all(tasks).then(() => {
            this._logger.env(`Application initialization: stage #${stage + 1}: OK`);
            this.init(stage + 1);
        }).catch((error: Error) => {
            this._logger.env(`Fail to initialize application dure error: ${error.message}`);
        });
    }

}

(new Application()).init();
