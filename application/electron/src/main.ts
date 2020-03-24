// Libs
import { dialog, MessageBoxReturnValue, app, Event } from 'electron';
import { CommonInterfaces } from './interfaces/interface.common';
import { IApplication, EExitCodes } from './interfaces/interface.app';

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

enum EAppState {
    initing = 'initing',
    working = 'working',
    destroying = 'destroying',
}

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

class Application implements IApplication {

    private _logger: Logger = new Logger('Application');
    private _state: EAppState = EAppState.initing;
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
                        this._logger.debug(`Selected option: ${response}`);
                        switch (response.response) {
                            case 0:
                                FS.rmdir(getHomeFolder()).then(() => {
                                    app.quit();
                                }).catch((errorRmdir: Error) => {
                                    this._logger.error(`Fail to drop settings due error: ${errorRmdir.message}`);
                                    app.quit();
                                });
                                break;
                            case 1:
                                app.quit();
                                break;
                        }
                    });
                    return reject(error);
                }
                resolve(this);
            });
        });
    }

    public close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._unbindProcessEvents();
            if (this._state === EAppState.destroying) {
                // Destroy method was already called.
                return reject(new Error(`Close process is already running`));
            }
            this._state = EAppState.destroying;
            // Lock IPC
            ServiceElectron.lock();
            // Close window
            ServiceElectron.closeWindow().then(() => {
                this._logger.debug(`Browser window is closed`);
            }).catch((closeWinErr: Error) => {
                this._logger.warn(`Fail to close browser window before close due error: ${closeWinErr.message}`);
            }).finally(() => {
                // Close all active sessions
                ServiceStreams.closeAll().then(() => {
                    this._logger.debug(`All streams are closed`);
                }).catch((closeErr: Error) => {
                    this._logger.warn(`Fail to close all session before close due error: ${closeErr.message}`);
                }).finally(() => {
                    // Shutdown all plugins
                    ServicePlugins.accomplish().then(() => {
                        this._logger.debug(`All plugins actions are accomplish`);
                    }).catch((shutdownErr: Error) => {
                        this._logger.warn(`Fail to accomplish plugins actions due error: ${shutdownErr.message}`);
                    }).finally(() => {
                        // Shutdown application
                        this._destroy(InitializeStages.length - 1, (error?: Error) => {
                            if (error instanceof Error) {
                                return reject(error);
                            }
                            resolve();
                        });
                    });
                });
            });
        });
    }

    public destroy(code: EExitCodes = EExitCodes.normal): Promise<void> {
        return new Promise((resolve, reject) => {
            this.close().catch((error: Error) => {
                this._logger.warn(`Fail correctly close app due error: ${error.message}`);
            }).finally(() => {
                this._quit(code);
                resolve();
            });
        });
    }

    public getLogger(): Logger {
        return this._logger;
    }

    private _init(stage: number = 0, callback: (error?: Error) => any): void {
        if (InitializeStages.length <= stage) {
            this._logger.debug(`Application is initialized`);
            this._state = EAppState.working;
            if (typeof callback === 'function') {
                callback();
            }
            return;
        }
        this._logger.debug(`Application initialization: stage #${stage + 1}: starting...`);
        const services: any[] = InitializeStages[stage];
        const tasks: Array<Promise<any>> = services.map((ref: any) => {
            this._logger.debug(`Init: ${ref.getName()}`);
            return ref.init(this).catch((err: Error) => {
                this._logger.error(`${ref.getName()}: ${err.message}`);
                return Promise.reject(err);
            });
        });
        if (tasks.length === 0) {
            return this._init(stage + 1, callback);
        }
        Promise.all(tasks).then(() => {
            this._logger.debug(`Application initialization: stage #${stage + 1}: OK`);
            this._init(stage + 1, callback);
        }).catch((error: Error) => {
            this._logger.debug(`Fail to initialize application dure error: ${error.message}`);
            callback(error);
        });
    }

    private _destroy(stage: number = 0, callback: (error?: Error) => any): void {
        if (stage < 0) {
            this._logger.debug(`Application is destroyed`);
            if (typeof callback === 'function') {
                callback();
            }
            return;
        }
        this._logger.debug(`Application destroy: stage #${stage + 1}: starting...`);
        const services: any[] = InitializeStages[stage];
        const tasks: Array<Promise<any>> = services.map((ref: any) => {
            this._logger.debug(`Destroy: ${ref.getName()}: started...`);
            return ref.destroy().then(() => {
                this._logger.debug(`Destroy: ${ref.getName()}: DONE`);
            }).catch((err: Error) => {
                this._logger.error(`Destroy: ${ref.getName()}: FAILED due: ${err.message}`);
            });
        });
        if (tasks.length === 0) {
            return this._destroy(stage - 1, callback);
        }
        Promise.all(tasks).then(() => {
            this._logger.debug(`Application destroyed: stage #${stage + 1}: OK`);
            this._destroy(stage - 1, callback);
        }).catch((error: Error) => {
            this._logger.debug(`Fail to destroy application dure error: ${error.message}`);
            callback(error);
        });
    }

    private _bindProcessEvents() {
        process.once('exit', this._onClose.bind(this));
        process.once('SIGINT', this._onClose.bind(this));
        process.once('SIGTERM', this._onClose.bind(this));
        app.once('will-quit', (event: Event) => {
            event.preventDefault();
            this._onClose();
        });
        process.on('uncaughtException', this._onUncaughtException.bind(this));
        process.on('unhandledRejection', this._onUnhandledRejection.bind(this));
    }

    private _unbindProcessEvents() {
        ['exit', 'SIGINT', 'SIGTERM'].forEach((e: string) => {
            process.removeAllListeners(e);
        });
        app.removeAllListeners('will-quit');
    }

    private _onUnhandledRejection(reason: Error | any, promise: Promise<any>) {
        if (reason instanceof Error) {
            this._logger.error(`[BAD] UnhandledRejection: ${reason.message}`);
        } else {
            this._logger.error(`[BAD] UnhandledRejection happened. No reason as error was provided.`);
        }
    }

    private _onUncaughtException(error: Error) {
        this._logger.error(`[BAD] UncaughtException: ${error.message}`);
    }

    private _onClose() {
        this._unbindProcessEvents();
        this._logger.debug(`Application would be closed.`);
        process.stdin.resume();
        // Destroy services
        this.close().catch((error: Error) => {
            this._logger.warn(`Fail correctly close app due error: ${error.message}`);
        }).then(() => {
            this._quit();
        });
    }

    private _quit(code: EExitCodes = EExitCodes.normal) {
        this._logger.debug(`Application are ready to be closed with code "${code}".`);
        this._logger.debug(`LogsService will be shutdown.`);
        LogsService.shutdown().then(() => {
            process.exit(code);
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

(new Application()).init().then((application: Application) => {
    application.getLogger().debug(`Application is ready.`);
    ServiceElectronState.setStateAsReady();
    ServicePlugins.revision();
}).catch((error: Error) => {
    // tslint:disable-next-line:no-console
    console.log(error);
});
