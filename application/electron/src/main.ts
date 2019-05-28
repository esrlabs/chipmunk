// Libs
import Logger from './tools/env.logger';

// Services
import ServiceElectron from './services/service.electron';
import ServicePackage from './services/service.package';
import ServiceEnv from './services/service.env';
import ServicePaths from './services/service.paths';
import ServicePlugins from './services/service.plugins';
import ServiceStreams from './services/service.streams';
import ServiceSettings from './services/service.settings';
import ServiceWindowState from './services/service.window.state';
import ServiceElectronState from './services/service.electron.state';
import ServiceProduction from './services/service.production';
import ServiceFileParsers from './services/service.file.parsers';
import ServiceMergeFiles from './services/service.merge.files';
import ServiceStreamSources from './services/service.stream.sources';
import ServiceFilters from './services/service.filters';

const InitializeStages = [
    // Stage #1
    [ServiceProduction],
    // Stage #2
    [ServicePaths],
    // Stage #3
    [ServicePackage],
    // Stage #4
    [ServiceSettings, ServiceWindowState],
    // Stage #5. Init electron. Prepare browser window
    [ServiceElectron],
    // Stage #6. Init services and helpers
    [ServiceElectronState],
    // Stage #7. Stream service
    [ServiceStreamSources, ServiceStreams],
    // Stage #8. Detect OS env
    [ServiceEnv],
    // Stage #9, Render functionality
    [ServiceFileParsers, ServiceMergeFiles, ServiceFilters],
    // Stage #10. Init plugins
    [ServicePlugins],
    // (last service should startup service and should be single always)
];

class Application {

    public logger: Logger = new Logger('Application');

    /**
     * Initialization of application
     * Will start application in case of success of initialization
     * @returns void
     */
    public init(): Promise<Application> {
        return new Promise((resolve, reject) => {
            this._init(0, (error?: Error) => {
                if (error instanceof Error) {
                    return reject(error);
                }
                this._bindProcessEvents();
                resolve(this);
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._destroy(InitializeStages.length - 1, (error?: Error) => {
                if (error instanceof Error) {
                    return reject(error);
                }
                resolve();
            });
        });
    }

    private _init(stage: number = 0, callback: (error?: Error) => any): void {
        if (InitializeStages.length <= stage) {
            this.logger.env(`Application is initialized`);
            typeof callback === 'function' && callback();
            return;
        }
        this.logger.env(`Application initialization: stage #${stage + 1}: starting...`);
        const services: any[] = InitializeStages[stage];
        const tasks: Array<Promise<any>> = services.map((ref: any) => {
            this.logger.env(`Init: ${ref.getName()}`);
            return ref.init();
        });
        if (tasks.length === 0) {
            return this._init(stage + 1, callback);
        }
        Promise.all(tasks).then(() => {
            this.logger.env(`Application initialization: stage #${stage + 1}: OK`);
            this._init(stage + 1, callback);
        }).catch((error: Error) => {
            this.logger.env(`Fail to initialize application dure error: ${error.message}`);
            callback(error);
        });
    }

    private _destroy(stage: number = 0, callback: (error?: Error) => any): void {
        if (stage < 0) {
            this.logger.env(`Application is destroyed`);
            typeof callback === 'function' && callback();
            return;
        }
        this.logger.env(`Application destroy: stage #${stage + 1}: starting...`);
        const services: any[] = InitializeStages[stage];
        const tasks: Array<Promise<any>> = services.map((ref: any) => {
            this.logger.env(`Destroy: ${ref.getName()}`);
            return ref.destroy();
        });
        if (tasks.length === 0) {
            return this._destroy(stage - 1, callback);
        }
        Promise.all(tasks).then(() => {
            this.logger.env(`Application destroyed: stage #${stage + 1}: OK`);
            this._destroy(stage - 1, callback);
        }).catch((error: Error) => {
            this.logger.env(`Fail to destroy application dure error: ${error.message}`);
            callback(error);
        });
    }

    private _bindProcessEvents() {
        process.on('exit', this._process_onExit.bind(this));
        process.on('SIGINT', this._process_onExit.bind(this));
        process.on('uncaughtException', this._process_onException.bind(this));
    }

    private _process_onExit() {
        // Remove existing handlers
        process.removeAllListeners();
        // Prevent closing application
        process.stdin.resume();
        // Destroy services
        this.destroy().then(() => {
            this.logger.env(`Application are ready to be closed.`);
            process.exit(0);
        });
    }

    private _process_onException(error: Error) {
        this.logger.error(`Uncaught Exception: ${error.message}`, error.stack);
    }

}

(new Application()).init().then((app: Application) => {
    app.logger.env(`Application is ready.`);
    ServiceElectronState.setStateAsReady();
}).catch((error: Error) => {
    throw error;
});
