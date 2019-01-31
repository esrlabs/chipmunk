
import * as uuid from 'uuid';

import { app } from 'electron';

import Logger from '../../platform/node/src/env.logger';

import { THandler } from '../../platform/cross/src/types.common';
import { IService } from '../interfaces/interface.service';

import ServicePackage from './service.package';
import ServicePath from './service.paths';
import ServiceSettings from './service.settings';
import ServiceWindowState from './service.window.state';

import ControllerBrowserWindow from '../controllers/controller.browserwindow';

/**
 * @class ServiceElectron
 * @description Electron instance
 */

class ServiceElectron implements IService {

    private _logger: Logger = new Logger('ServiceElectron');
    private _controllerBrowserWindow: ControllerBrowserWindow | null = null;
    private _onReadyResolve: THandler | null = null;

    constructor() {
        this._onReady = this._onReady.bind(this);
        this._onClosed = this._onClosed.bind(this);
        this._onActivate = this._onActivate.bind(this);
        this._onWindowClosed = this._onWindowClosed.bind(this);
    }

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._bind();
            if (this._controllerBrowserWindow !== null) {
                return resolve();
            }
            this._onReadyResolve = resolve;
        });
    }

    public getName(): string {
        return 'ServiceElectron';
    }

    private _bind() {
        app.on('ready', this._onReady);
        app.on('activate', this._onActivate);
        app.on('window-all-closed', this._onClosed);
    }

    private _createBrowserWindow() {
        if (this._controllerBrowserWindow !== null) {
            return;
        }
        this._controllerBrowserWindow = new ControllerBrowserWindow(uuid.v4());
        this._controllerBrowserWindow.subscribe(ControllerBrowserWindow.Events.closed, this._onWindowClosed);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Electron events
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _onReady() {
        // Create client
        this._createBrowserWindow();
        // Menu
        // Files from cmd
        // cmd
        // Finish initialization
        this._onReadyResolve !== null && this._onReadyResolve();
    }

    private _onActivate() {
        // Create client if it's needed
        this._createBrowserWindow();
    }

    private _onClosed() {
		if (process.platform !== 'darwin') {
			app.quit();
		}
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Browser window events
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _onWindowClosed() {
        if (this._controllerBrowserWindow === null) {
            return;
        }
        this._controllerBrowserWindow.destroy();
        this._controllerBrowserWindow = null;
    }

}

export default (new ServiceElectron());
