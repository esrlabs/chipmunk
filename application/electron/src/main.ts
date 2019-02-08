// Libs
import Logger from '../platform/node/src/env.logger';

// Services
import ServiceElectron from './services/service.electron';
import ServicePackage from './services/service.package';
import ServicePaths from './services/service.paths';
import ServicePlugins from './services/service.plugins';
import ServiceSettings from './services/service.settings';
import ServiceWindowState from './services/service.window.state';
import ServiceElectronService from './services/service.electron.state';

const InitializeStages = [
    // Stage #1
    [ServicePaths],
    // Stage #2
    [ServicePackage],
    // Stage #3
    [ServiceSettings, ServiceWindowState],
    // Stage #4. Init electron. Prepare browser window
    [ServiceElectron],
    // Stage #5. Init services and helpers
    [ServiceElectronService],
    // Stage #6. Init plugins
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
                resolve(this);
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

}

(new Application()).init().then((app: Application) => {
    app.logger.env(`Application is ready.`);
    // initialization of plugins?
    // registration events?
    /*
    setInterval(() => {
        ServiceElectron.IPC.send(ServiceElectron.IPCMessages.HostState, new ServiceElectron.IPCMessages.HostState({
            message: 'hello',
            state: ServiceElectron.IPCMessages.HostState.States.ready,
        })).then(() => {
            console.log('sent');
        }).catch((error: Error) => {
            console.log(`cannot send package`);
        });
    }, 2000);
    */
/*
    ServiceElectron.IPC.subscribe('toServer', (a, b, c) => {
        console.log(`!!!!!`);
        console.log(a, b, c);
        console.log(`!!!!!`);
    }).then((subscription) => {
        console.log('done');
    }).catch((error: Error) => {
        console.log(`cannot make subscription`);
    });
    */

}).catch((error: Error) => {
    throw error;
});

/*
    ServiceElectron.IPC.subscribe('toServer', (a, b, c) => {
        console.log(`!!!!!`);
        console.log(a, b, c);
        console.log(`!!!!!`);
    }).then((subscription) => {
        console.log('done');
    }).catch((error: Error) => {
        console.log(`cannot make subscription`);
    });
    setInterval(() => {
        ServiceElectron.IPC.send('toClient', 'hello', 'client').then(() => {
            console.log('sent');
        }).catch((error: Error) => {
            console.log(`cannot send package`);
        });
    }, 2000);
*/
