// Libs
import Logger from '../platform/node/src/env.logger';

// Services
import ServiceElectron from './service.electron';
import ServicePackage from './service.package';
import ServicePaths from './service.paths';
import ServiceSettings from './service.settings';
import ServiceWindowState from './service.window.state';

const InitializeStages = [
    // Stage #1
    [ServicePaths],
    // Stage #2
    [ServiceSettings, ServiceWindowState, ServicePackage],
    // Stage #3
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
            return this._start();
        }
        this._logger.env(`Application initialization: stage #${stage + 1}: starting...`);
        const services: any[] = InitializeStages[stage];
        const tasks: Array<Promise<any>> = services.map((ref: any) => {
            this._logger.env(`Init: ${ref.constructor.name}`);
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

    private _start() {
        this._logger.env(`Started.`);
        // start app here
    }

}

(new Application()).init();
