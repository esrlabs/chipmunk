// Libs
import Logger from './tools/env.logger';
import { app as electronApp, dialog, MessageBoxReturnValue } from 'electron';
import * as FS from './tools/fs';
// Services
import ServiceElectron from './services/service.electron';
import ServiceNotifications from './services/service.notifications';
import ServicePackage from './services/service.package';
import ServiceEnv from './services/service.env';
import ServiceHotkeys from './services/service.hotkeys';
import ServicePaths, { getHomeFolder } from './services/service.paths';
import ServicePlugins from './services/service.plugins';
import ServiceStreams from './services/service.streams';
import ServiceSettings from './services/service.settings';
import ServiceStorage from './services/service.storage';
import ServiceWindowState from './services/service.window.state';
import ServiceElectronState from './services/service.electron.state';
import ServiceProduction from './services/service.production';
import ServiceFileInfo from './services/files/service.file.info';
import ServiceMergeFiles from './services/features/service.merge.files';
import ServiceConcatFiles from './services/features/service.concat.files';
import ServiceFileReader from './services/files/service.file.reader';
import ServiceFileSearch from './services/files/service.file.search';
import ServiceFileOpener from './services/files/service.file.opener';
import ServiceFilePicker from './services/files/service.file.picker';
import ServiceStreamSources from './services/service.stream.sources';
import ServiceFilters from './services/service.filters';
import ServiceAppState from './services/service.app.state';
import ServiceUpdate from './services/service.update';
import ServiceDLTFiles from './services/parsers/service.dlt.files';
import ServicePatchesBefore from './services/service.patches.before';

const InitializeStages = [
    // Apply patches ("before")
    [   ServicePatchesBefore ],
    // Stage #1
    [   ServiceProduction ],
    // Stage #2
    [   ServicePaths ],
    // Stage #3
    [   ServicePackage ],
    // Stage #4
    [   ServiceSettings, ServiceWindowState, ServiceStorage ],
    // Stage #5. Init electron. Prepare browser window
    [   ServiceElectron ],
    // Stage #6. Init services and helpers
    [   ServiceElectronState, ServiceNotifications ],
    // Stage #7. Stream service
    [   ServiceStreamSources, ServiceStreams ],
    // Stage #8. Detect OS env
    [   ServiceEnv ],
    // Stage #9. Common functionality
    [   ServiceFileInfo, ServiceMergeFiles,
        ServiceConcatFiles, ServiceFileSearch,
        ServiceFilters, ServiceFileReader,
        ServiceFileOpener, ServiceAppState,
        ServiceDLTFiles, ServiceHotkeys,
        ServiceFilePicker,
    ],
    // Stage #10. Init plugins
    [   ServicePlugins ],
    // (last service should startup service and should be single always)
    [   ServiceUpdate ],
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
            this._bindProcessEvents();
            this._init(0, (error?: Error) => {
                if (error instanceof Error) {
                    const dialogOpts = {
                        type: 'info',
                        buttons: ['Drop settings and close', 'Close'],
                        title: 'Error',
                        message: `Sorry, it looks like we have a problems with starting. You can try to drop settings and start it again.`,
                        detail: `Error: ${error.message}`,
                    };
                    dialog.showMessageBox(dialogOpts).then((response: MessageBoxReturnValue) => {
                        this.logger.env(`Selected option: ${response}`);
                        switch (response.response) {
                            case 0:
                                FS.rmdir(getHomeFolder()).then(() => {
                                    electronApp.quit();
                                }).catch((errorRmdir: Error) => {
                                    this.logger.error(`Fail to drop settings due error: ${errorRmdir.message}`);
                                    electronApp.quit();
                                });
                                break;
                            case 1:
                                electronApp.quit();
                                break;
                        }
                    });
                    return reject(error);
                }
                resolve(this);
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Remove existing handlers
            process.removeAllListeners();
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
            if (typeof callback === 'function') {
                callback();
            }
            return;
        }
        this.logger.env(`Application initialization: stage #${stage + 1}: starting...`);
        const services: any[] = InitializeStages[stage];
        const tasks: Array<Promise<any>> = services.map((ref: any) => {
            this.logger.env(`Init: ${ref.getName()}`);
            return ref.init(this);
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
            if (typeof callback === 'function') {
                callback();
            }
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
        process.on('uncaughtException', this._onUncaughtException.bind(this));
        process.on('unhandledRejection', this._onUnhandledRejection.bind(this));
    }

    private _onUnhandledRejection(reason: Error | any, promise: Promise<any>) {
        if (reason instanceof Error) {
            this.logger.error(`[BAD] UnhandledRejection: ${reason.message}`);
        } else {
            this.logger.error(`[BAD] UnhandledRejection happened. No reason as error was provided.`);
        }
    }

    private _onUncaughtException(error: Error) {
        this.logger.error(`[BAD] UncaughtException: ${error.message}`);
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

}

(new Application()).init().then((app: Application) => {
    app.logger.env(`Application is ready.`);
    ServiceElectronState.setStateAsReady();
}).catch((error: Error) => {
    throw error;
});
