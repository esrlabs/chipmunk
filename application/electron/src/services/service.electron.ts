
// tslint:disable:ban-types

import * as uuid from 'uuid';

import { app } from 'electron';

import Logger from '../../platform/node/src/env.logger';

import { Subscription } from '../../platform/cross/src/index';
import { THandler } from '../../platform/cross/src/types.common';
import { IService } from '../interfaces/interface.service';

import ControllerElectronIpc from '../controllers/controller.electron.ipc';

import ControllerBrowserWindow from '../controllers/controller.browserwindow';

import { IPCMessages } from '../controllers/controller.electron.ipc';

export { IPCMessages, Subscription };

/**
 * @class ServiceElectron
 * @description Electron instance
 */

class ServiceElectron implements IService {

    public IPCMessages = IPCMessages;

    public IPC: {
        send: (instance: IPCMessages.TMessage) => Promise<void>,
        request: (instance: IPCMessages.TMessage) => Promise<any>,
        subscribe: (event: Function, handler: (event: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) => any) => Promise<Subscription>,
    } = {
        send: this._send.bind(this),
        request: this._request.bind(this),
        subscribe: this._subscribe.bind(this),
    };

    private _logger: Logger = new Logger('ServiceElectron');
    private _controllerBrowserWindow: ControllerBrowserWindow | undefined;
    private _onReadyResolve: THandler | null = null;
    private _ready: {
        electron: boolean;
        service: boolean;
    } = {
        electron: false,
        service: false,
    };

    constructor() {
        this._onReady = this._onReady.bind(this);
        this._onClosed = this._onClosed.bind(this);
        this._onActivate = this._onActivate.bind(this);
        this._onWindowClosed = this._onWindowClosed.bind(this);
        this._bind();
    }

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._onReadyResolve = resolve;
            this._ready.service = true;
            this._init();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
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

    public redirectIPCMessageToPluginRender(message: IPCMessages.PluginInternalMessage, sequence?: string) {
        if (this._controllerBrowserWindow === undefined) {
            return this._logger.error(`Fail to redirect message of plugin by token: ${message.token}, because BrowserWindow is undefined. Income message: ${message.data}`);
        }
        this._controllerBrowserWindow.getIpc().then((ipc: ControllerElectronIpc) => {
            ipc.send(message, sequence).catch((sendingError: Error) => {
                this._logger.error(`Fail redirect message by token ${message.token} due error: ${sendingError.message}`);
            });
        }).catch((error: Error) => {
            this._logger.error(`Fail redirect message by token ${message.token} due error: ${error.message}`);
        });
    }
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Electron IPC
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _subscribe(event: Function, handler: (event: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) => any): Promise<Subscription> {
        return new Promise((resolve, reject) => {
            if (this._controllerBrowserWindow === undefined) {
                return reject(new Error(`Browser window isn't inited yet, cannot delivery IPC controller.`));
            }
            this._controllerBrowserWindow.getIpc().then((ipc: ControllerElectronIpc) => {
                ipc.subscribe(event, handler).then((subscription: Subscription) => {
                    resolve(subscription);
                }).catch((subscribeError: Error) => {
                    this._logger.warn(`Fail to subscribe due error: ${subscribeError.message}`);
                    return reject(subscribeError);
                });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _send(instance: IPCMessages.TMessage, sequence?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._controllerBrowserWindow === undefined) {
                return reject(new Error(`Browser window isn't inited yet, cannot delivery IPC controller.`));
            }
            this._controllerBrowserWindow.getIpc().then((ipc: ControllerElectronIpc) => {
                ipc.send(instance).then(() => {
                    resolve();
                }).catch((sendingError: Error) => {
                    return reject(new Error(this._logger.warn(`Fail to send message via IPC due error: ${sendingError.message}`)));
                });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _request(instance: IPCMessages.TMessage): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this._controllerBrowserWindow === undefined) {
                return reject(new Error(`Browser window isn't inited yet, cannot delivery IPC controller.`));
            }
            this._controllerBrowserWindow.getIpc().then((ipc: ControllerElectronIpc) => {
                ipc.request(instance).then((response: any) => {
                    resolve(response);
                }).catch((sendingError: Error) => {
                    return reject(new Error(this._logger.warn(`Fail to send message via IPC due error: ${sendingError.message}`)));
                });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Internal
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _bind() {
        app.on('ready', this._onReady);
        app.on('activate', this._onActivate);
        app.on('window-all-closed', this._onClosed);
    }

    private _init() {
        if (!this._ready.electron || !this._ready.service) {
            return;
        }
        // Create client
        this._createBrowserWindow();
        this._controllerBrowserWindow !== undefined && this._controllerBrowserWindow.debug();
        // Menu
        // Files from cmd
        // cmd
        // Finish initialization
        this._onReadyResolve !== null && this._onReadyResolve();
        this._onReadyResolve = null;
    }

    private _createBrowserWindow() {
        if (this._controllerBrowserWindow !== undefined) {
            return;
        }
        this._logger.env(`Creating new browser window`);
        this._controllerBrowserWindow = new ControllerBrowserWindow(uuid.v4());
        this._controllerBrowserWindow.subscribe(ControllerBrowserWindow.Events.closed, this._onWindowClosed);
    }

    private _destroyBrowserWindow() {
        if (this._controllerBrowserWindow === undefined) {
            return;
        }
        this._logger.env(`Destroing browser window`);
        this._controllerBrowserWindow.destroy();
        this._controllerBrowserWindow = undefined;
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
        this._createBrowserWindow();
    }

    private _onClosed() {
        this._destroyBrowserWindow();
        if (process.platform !== 'darwin') {
            this._logger.env(`Quit application`);
            return app.quit();
        }
        this._logger.env(`Darwin platform is detected. Application is deactivated.`);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Browser window events
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _onWindowClosed() {
        this._logger.env(`Window is closed.`);
        this._destroyBrowserWindow();
    }

}

export default (new ServiceElectron());
