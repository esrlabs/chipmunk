
// tslint:disable:ban-types

import * as uuid from 'uuid';

import { app, BrowserWindow, Event } from 'electron';
import { Lock } from '../tools/env.lock';
import { inspect } from 'util';
import { Subscription } from '../tools/index';
import { THandler } from '../tools/types.common';
import { IService } from '../interfaces/interface.service';
import { IPCMessages } from '../controllers/electron/controller.electron.ipc';
import { IApplication, EExitCodes } from '../interfaces/interface.app';

import ControllerElectronIpc from '../controllers/electron/controller.electron.ipc';
import ServiceProduction from './service.production';
import ServiceEnv from './service.env';
import ControllerBrowserWindow from '../controllers/electron/controller.browserwindow';
import ControllerElectronMenu from '../controllers/electron/controller.electron.menu';
import Logger from '../tools/env.logger';

export { IPCMessages, Subscription };

/**
 * @class ServiceElectron
 * @description Electron instance
 */

class ServiceElectron implements IService {

    public IPCMessages = IPCMessages;

    public IPC: {
        send: (instance: IPCMessages.TMessage) => Promise<void>,
        request: (instance: IPCMessages.TMessage, expected?: IPCMessages.TMessage) => Promise<any>,
        subscribe: (event: Function, handler: (event: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) => any) => Promise<Subscription>,
        available: () => boolean,
    } = {
        send: this._send.bind(this),
        request: this._request.bind(this),
        subscribe: this._subscribe.bind(this),
        available: this.available.bind(this),
    };

    private _logger: Logger = new Logger('ServiceElectron');
    private _controllerBrowserWindow: ControllerBrowserWindow | undefined;
    private _controllerElectronMenu: ControllerElectronMenu | undefined;
    private _onReadyResolve: THandler | null = null;
    private _ipc: ControllerElectronIpc | undefined;
    private _ipcLock: Lock = new Lock(false);
    private _ready: {
        electron: boolean;
        service: boolean;
    } = {
        electron: false,
        service: false,
    };
    private _app: IApplication | undefined;

    constructor() {
        this._configure();
        this._bind();
    }

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(application: IApplication): Promise<void> {
        return new Promise((resolve) => {
            this._app = application;
            this._onReadyResolve = resolve;
            this._ready.service = true;
            this._init();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            if (this._controllerBrowserWindow === undefined) {
                return resolve();
            }
            this._logger.debug(`Destroing browser window`);
            this._controllerBrowserWindow.destroy();
            this._controllerBrowserWindow = undefined;
            if (this._ipc !== undefined) {
                this._ipc.destroy();
                this._ipc = undefined;
            }
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceElectron';
    }

    public getVersion(): string | Error {
        if (process.versions === void 0 || process.versions === null) {
            return new Error(this._logger.error(`Fail to find electron version. Object "versions" isn't valid.`));
        }
        if (typeof process.versions.electron !== 'string' || process.versions.electron.trim() === '') {
            return new Error(this._logger.error(`Fail to find electron version. Field "electron" has incorrect format: ${typeof process.versions.electron}/"${process.versions.electron}"`));
        }
        return process.versions.electron;
    }

    public redirectIPCMessageToPluginRender(message: IPCMessages.PluginInternalMessage | IPCMessages.PluginError, sequence?: string) {
        if (this._ipc === undefined) {
            return this._logger.error(`Fail to redirect message of plugin by token: ${message.token}, because IPC is undefined. Income message: ${message.data}`);
        }
        this._ipc.send(message, sequence).catch((sendingError: Error) => {
            this._logger.error(`Fail redirect message by token ${message.token} due error: ${sendingError.message}`);
        });
    }

    public updateMenu() {
        if (this._controllerElectronMenu === undefined) {
            return;
        }
        this._controllerElectronMenu.rebuild();
    }

    public getMenu(): ControllerElectronMenu | undefined {
        return this._controllerElectronMenu;
    }

    /*
    public quit(code: EExitCodes = EExitCodes.normal) {
        this._logger.debug(`Closing app with code: ${code}`);
        app.exit(code);
        process.exit(code);
    }
    */

    public getBrowserWindow(): BrowserWindow | undefined {
        if (this._controllerBrowserWindow === undefined) {
            return undefined;
        }
        return this._controllerBrowserWindow.getBrowserWindow();
    }

    public lock(): void {
        this._ipcLock.lock();
    }

    public available(): boolean {
        return this._ipc === undefined ? false : !this._ipcLock.isLocked();
    }

    public closeWindow(): Promise<void> {
        return new Promise((resolve) => {
            if (this._controllerBrowserWindow === undefined) {
                return resolve();
            }
            this._controllerBrowserWindow.close().catch((error: Error) => {
                this._logger.warn(`Fail to destroy ControllerBrowserWindow due error: ${error.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Electron IPC
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _subscribe(event: Function, handler: (event: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) => any): Promise<Subscription> {
        return new Promise((resolve, reject) => {
            if (this._ipcLock.isLocked()) {
                return reject(new Error(`IPC is locked.`));
            }
            if (this._ipc === undefined) {
                return reject(new Error(`IPC isn't inited yet, cannot delivery IPC controller.`));
            }
            this._ipc.subscribe(event, handler).then((subscription: Subscription) => {
                resolve(subscription);
            }).catch((subscribeError: Error) => {
                this._logger.warn(`Fail to subscribe due error: ${subscribeError.message}`);
                reject(subscribeError);
            });
        });
    }

    private _send(instance: IPCMessages.TMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._ipcLock.isLocked()) {
                return reject(new Error(`IPC is locked.`));
            }
            if (this._ipc === undefined) {
                return reject(new Error(`IPC controller isn't inited yet, cannot delivery IPC controller.`));
            }
            this._ipc.send(instance).then(() => {
                resolve();
            }).catch((sendingError: Error) => {
                reject(new Error(this._logger.warn(`Fail to send message via IPC due error: ${sendingError.message}. Message: ${inspect(instance)}`)));
            });
        });
    }

    private _request(instance: IPCMessages.TMessage, expected?: IPCMessages.TMessage): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this._ipcLock.isLocked()) {
                return reject(new Error(`IPC is locked.`));
            }
            if (this._ipc === undefined) {
                return reject(new Error(`IPC controller isn't inited yet, cannot delivery IPC controller.`));
            }
            this._ipc.request(instance, expected).then((response: any) => {
                resolve(response);
            }).catch((sendingError: Error) => {
                reject(new Error(this._logger.warn(`Fail to send message via IPC due error: ${sendingError.message}. Message: ${inspect(instance)}`)));
            });
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Internal
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _bind() {
        app.once('ready', this._onReady.bind(this));
        app.once('activate', this._onActivate.bind(this));
    }

    private _configure() {
        this._logger.debug(`Hardware acceleration is disabled.`);
        app.disableHardwareAcceleration();
    }

    private _init() {
        if (!this._ready.electron || !this._ready.service) {
            return;
        }
        // Create client
        this._createBrowserWindow().then(() => {
            if (!ServiceProduction.isProduction() && !ServiceEnv.get().CHIPMUNK_NO_WEBDEVTOOLS) {
                if (this._controllerBrowserWindow !== undefined) {
                    this._controllerBrowserWindow.debug();
                }
            }
            // Menu
            this._controllerElectronMenu = new ControllerElectronMenu();
                // Files from cmd
                // cmd
                // Finish initialization
                if (this._onReadyResolve !== null) {
                    this._onReadyResolve();
                    this._onReadyResolve = null;
                }
        }).catch((error: Error) => {
            this._logger.error(`Failed to create browser window due to error: ${error.message}`);
        });
    }

    private _createBrowserWindow(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._controllerBrowserWindow !== undefined) {
                return resolve();
            }
            this._logger.debug(`Creating new browser window`);
            this._controllerBrowserWindow = new ControllerBrowserWindow(uuid.v4());
            this._controllerBrowserWindow.getIpc().then((ipc: ControllerElectronIpc | undefined) => {
                this._ipc = ipc;
                resolve();
            }).catch((error: Error) => {
                reject(this._logger.error(`Fail to get IPC: ${error.message}`));
            });
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Electron events
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _onReady() {
        this._ready.electron = true;
        this._init();
    }

    private _onActivate() {
        // Create client if it's needed
        this._createBrowserWindow().catch((error: Error) => {
            this._logger.error(`Failed to create browser window due to error: ${error.message}`);
        });
    }

}

export default (new ServiceElectron());
