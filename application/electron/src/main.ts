// Libs
import { app as electronApp, dialog, MessageBoxReturnValue } from 'electron';
import { CommonInterfaces } from './interfaces/interface.common';

import * as FS from './tools/fs';

import Logger from './tools/env.logger';
import LogsService from './tools/env.logger.service';

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
import ServiceDLTDeamonConnector from './services/connectors/service.dlt.deamon';
import ServiceOutputExport from './services/output/service.output.export';
import ServiceRenderState from './services/service.render.state';

const InitializeStages = [
    // Apply patches ("before")
    [   ServicePatchesBefore ],
    // Stage #1. Detect OS env
    [   ServiceEnv ],
    // Stage #2
    [   ServiceProduction ],
    // Stage #3
    [   ServicePaths ],
    // Stage #4
    [   ServicePackage ],
    // Stage #5
    [   ServiceSettings, ServiceWindowState, ServiceStorage ],
    // Stage #6. Init electron. Prepare browser window
    [   ServiceElectron ],
    // Stage #7. Init services and helpers
    [   ServiceElectronState, ServiceNotifications, ServiceRenderState ],
    // Stage #8. Stream service
    [   ServiceStreamSources, ServiceStreams ],
    // Stage #9. Common functionality
    [   ServiceFileInfo, ServiceMergeFiles,
        ServiceConcatFiles, ServiceFileSearch,
        ServiceFilters, ServiceFileReader,
        ServiceFileOpener, ServiceAppState,
        ServiceDLTFiles, ServiceHotkeys,
        ServiceFilePicker, ServiceDLTDeamonConnector,
        ServiceOutputExport,
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
            this._initGlobalNamespace();
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
                        this.logger.debug(`Selected option: ${response}`);
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
            this.logger.debug(`Application is initialized`);
            if (typeof callback === 'function') {
                callback();
            }
            return;
        }
        this.logger.debug(`Application initialization: stage #${stage + 1}: starting...`);
        const services: any[] = InitializeStages[stage];
        const tasks: Array<Promise<any>> = services.map((ref: any) => {
            this.logger.debug(`Init: ${ref.getName()}`);
            return ref.init(this);
        });
        if (tasks.length === 0) {
            return this._init(stage + 1, callback);
        }
        Promise.all(tasks).then(() => {
            this.logger.debug(`Application initialization: stage #${stage + 1}: OK`);
            this._init(stage + 1, callback);
        }).catch((error: Error) => {
            this.logger.debug(`Fail to initialize application dure error: ${error.message}`);
            callback(error);
        });
    }

    private _destroy(stage: number = 0, callback: (error?: Error) => any): void {
        if (stage < 0) {
            this.logger.debug(`Application is destroyed`);
            if (typeof callback === 'function') {
                callback();
            }
            return;
        }
        this.logger.debug(`Application destroy: stage #${stage + 1}: starting...`);
        const services: any[] = InitializeStages[stage];
        const tasks: Array<Promise<any>> = services.map((ref: any) => {
            this.logger.debug(`Destroy: ${ref.getName()}: started...`);
            return ref.destroy().then(() => {
                this.logger.debug(`Destroy: ${ref.getName()}: DONE`);
            }).catch((err: Error) => {
                this.logger.error(`Destroy: ${ref.getName()}: FAILED due: ${err.message}`);
            });
        });
        if (tasks.length === 0) {
            return this._destroy(stage - 1, callback);
        }
        Promise.all(tasks).then(() => {
            this.logger.debug(`Application destroyed: stage #${stage + 1}: OK`);
            this._destroy(stage - 1, callback);
        }).catch((error: Error) => {
            this.logger.debug(`Fail to destroy application dure error: ${error.message}`);
            callback(error);
        });
    }

    private _bindProcessEvents() {
        process.once('exit', this._process_onExit.bind(this));
        process.once('SIGINT', this._process_onExit.bind(this));
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
        this.logger.debug(`Application would be closed.`);
        // Remove existing handlers
        // process.removeAllListeners();
        // Prevent closing application
        process.stdin.resume();
        // Destroy services
        this.destroy().then(() => {
            this.logger.debug(`Application are ready to be closed.`);
            this.logger.debug(`LogsService will be shutdown.`);
            LogsService.shutdown().then(() => {
                process.exit(0);
            });
        });
    }

    private _initGlobalNamespace() {
        const gLogger: Logger = new Logger('Global');
        const cGlobal: CommonInterfaces.NodeGlobal.IChipmunkNodeGlobal = {
            logger: {
                warn: gLogger.warn.bind(gLogger),
                debug: gLogger.debug.bind(gLogger),
                env: gLogger.env.bind(gLogger),
                error: gLogger.error.bind(gLogger),
                info: gLogger.info.bind(gLogger),
                verbose: gLogger.verbose.bind(gLogger),
                wtf: gLogger.wtf.bind(gLogger),
            },
        };
        (global as any).chipmunk = cGlobal;
    }

}

(new Application()).init().then((app: Application) => {
    app.logger.debug(`Application is ready.`);
    ServiceElectronState.setStateAsReady();
}).catch((error: Error) => {
    throw error;
});
