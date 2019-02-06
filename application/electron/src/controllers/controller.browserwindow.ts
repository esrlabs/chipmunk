import * as Url from 'url';

import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';

import Logger from '../../platform/node/src/env.logger';

import EventEmitter from '../../platform/cross/src/emitter';
import { IWindowState } from '../services/service.window.state.scheme';

import ServicePackage from '../services/service.package';
import ServicePath from '../services/service.paths';
import ServiceSettings from '../services/service.settings';
import ServiceWindowState from '../services/service.window.state';
import ControllerElectronIpc from './controller.electron.ipc';

export default class ControllerBrowserWindow extends EventEmitter {

    public static Events = {
        closed: Symbol(),
        created: Symbol(),
        ready: Symbol(),
    };

    private _window: BrowserWindow | undefined;
    private _guid: string;
    private _logger: Logger = new Logger('ControllerBrowserWindow');
    private _ipc: ControllerElectronIpc | undefined;

    constructor(guid: string) {
        super();
        this._guid = guid;
        this._onReady = this._onReady.bind(this);
        this._onClosed = this._onClosed.bind(this);
        this._onUpdate = this._onUpdate.bind(this);
        this._create().then(() => {
            this._logger.env(`BrowserWindow guid "${this._guid}" is created.`);
        }).catch((error: Error) => {
            this._logger.env(`Fail to create BrowserWindow guid "${this._guid}" due error: ${error.message}.`);
        });
    }

    public destroy() {
        this.unsubscribeAll();
        this._ipc !== undefined && this._ipc.destroy();
        this._ipc = undefined;
        this._window = undefined;
    }

    public debug() {
        if (this._window === undefined) {
            return;
        }
        this._window.webContents.openDevTools();
    }

    public getIpc(): Promise<ControllerElectronIpc> {
        return new Promise((resolve, reject) => {
            if (this._ipc === undefined) {
                return reject(new Error(`IPC isn't available`));
            }
            resolve(this._ipc);
        });
    }

    private _create(): Promise<void> {
        return new Promise((resolve, reject) => {
            const state: IWindowState = ServiceWindowState.get();
            const options: BrowserWindowConstructorOptions = {
                height: state.h,
                title: ServicePackage.get().version,
                width: state.w,
                x: state.x,
                y: state.y,
            };
            this._window = new BrowserWindow(options);
            const clientPath = ServicePath.resoveRootFolder(ServiceSettings.get().client.indexHtml);
            if (!ServicePath.isExist(clientPath)) {
                throw new Error(this._logger.error(`Cannot find client on path "${clientPath}"`));
            }
            this._window.loadURL(Url.format({
                pathname: clientPath,
			    protocol: 'file:',
			    slashes: true,
            }) + `?v${ServicePackage.get().version}`);
            state.max && this._window.maximize();
            this._ipc = new ControllerElectronIpc(this._guid, this._window.webContents);
            this._bind();
            this.emit(ControllerBrowserWindow.Events.created);
        });
    }

    private _bind() {
        if (this._window === undefined) {
            return;
        }
        this._window.on('resize', this._onUpdate);
        this._window.on('move', this._onUpdate);
        this._window.on('close', this._onUpdate);
        this._window.on('ready-to-show', this._onReady);
        this._window.on('closed', this._onClosed);
    }

    private _onUpdate() {
        if (this._window === undefined) {
            return;
        }
        const bounds = this._window.getBounds();
        ServiceWindowState.set({
            h: bounds.height,
            max: this._window.isMaximized(),
            w: bounds.width,
            x: bounds.x,
            y: bounds.y,
        });
    }

    private _onReady() {
        this.emit(ControllerBrowserWindow.Events.ready);
    }

    private _onClosed() {
        this.destroy();
        this.emit(ControllerBrowserWindow.Events.closed);
    }
}
