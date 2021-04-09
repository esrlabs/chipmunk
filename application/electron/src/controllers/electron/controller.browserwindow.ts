import * as Url from 'url';
import * as path from 'path';

import { BrowserWindow, BrowserWindowConstructorOptions, Event } from 'electron';
import { IWindowState } from '../../services/service.window.state.scheme';
import { CSettings } from '../../services/service.settings.default';

import EventEmitter from '../../tools/emitter';
import Logger from '../../tools/env.logger';
import ServicePackage from '../../services/service.package';
import ServicePath from '../../services/service.paths';
import ServiceSettings from '../../services/service.settings';
import ServiceWindowState from '../../services/service.window.state';
import ControllerElectronIpc from './controller.electron.ipc';
import ControllerElectronEnv from './controller.electron.env';

export default class ControllerBrowserWindow extends EventEmitter {

    private _window: BrowserWindow | undefined;
    private _guid: string;
    private _logger: Logger = new Logger('ControllerBrowserWindow');
    private _ipc: ControllerElectronIpc | undefined;
    private _env: ControllerElectronEnv | undefined;

    constructor(guid: string) {
        super();
        this._guid = guid;
        this._onReady = this._onReady.bind(this);
        this._onClosed = this._onClosed.bind(this);
        this._onUpdate = this._onUpdate.bind(this);
        this._create().then(() => {
            this._logger.debug(`BrowserWindow guid "${this._guid}" is created.`);
        }).catch((error: Error) => {
            this._logger.debug(`Fail to create BrowserWindow guid "${this._guid}" due error: ${error.message}.`);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            this.unsubscribeAll();
            if (this._ipc !== undefined) {
                this._ipc.destroy();
                this._logger.debug(`BrowserWindow IPC guid "${this._guid}" was destroyed.`);
            }
            this._ipc = undefined;
            if (this._window !== undefined) {
                this._window.destroy();
                this._logger.debug(`BrowserWindow guid "${this._guid}" was destroyed.`);
            }
            this._window = undefined;
            resolve();
        });
    }

    public close(): Promise<void> {
        return new Promise((resolve) => {
            if (this._window === undefined) {
                return resolve();
            }
            if (this._ipc !== undefined) {
                this._ipc.destroy();
                this._logger.debug(`BrowserWindow IPC guid "${this._guid}" was destroyed.`);
            }
            this._window.hide();
            /*if (getPlatform() === EPlatforms.darwin) {
                this._window.hide();
            } else {
                this._window.close();
            }*/
            resolve();
        });
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

    public getBrowserWindow(): BrowserWindow | undefined {
        return this._window;
    }

    private _create(): Promise<void> {
        return new Promise((resolve, reject) => {
            function getIcon(): string | undefined {
                switch (process.platform) {
                    case 'linux':
                        return path.resolve(ServicePath.getResources(), 'linux/chipmunk.png');
                    case 'win32':
                        return path.resolve(ServicePath.getResources(), 'win/chipmunk.ico');
                }
                return undefined;
            }
            const state: IWindowState = ServiceWindowState.getSettings().get();
            const options: BrowserWindowConstructorOptions = {
                height: state.h,
                title: ServicePackage.get().version,
                width: state.w,
                x: state.x,
                y: state.y,
                icon: getIcon(),
                webPreferences: {
                    nodeIntegration: true,
                    enableRemoteModule: false,
                },
            };
            this._window = new BrowserWindow(options);
            const index: string | Error = ServiceSettings.get(CSettings.client.index.getFullPath());
            if (index instanceof Error) {
                throw index;
            }
            const clientPath = ServicePath.resoveRootFolder(index);
            if (!ServicePath.isExist(clientPath)) {
                throw new Error(this._logger.error(`Cannot find client on path "${clientPath}"`));
            }
            this._window.loadURL(Url.format({
                pathname: clientPath,
			    protocol: 'file:',
			    slashes: true,
            }) + `?v${ServicePackage.get().version}`);
            if (state.max) {
                this._window.maximize();
            }
            this._ipc = new ControllerElectronIpc(this._guid, this._window.webContents);
            this._bind();
            this._env = new ControllerElectronEnv(this._guid, this._window, this._ipc);
            this._env.init().then(resolve).catch((err: Error) => {
                reject(new Error(this._logger.error(`Fail to init ControllerElectronEnv due error: ${err.message}`)));
            });
        });
    }

    private _bind() {
        if (this._window === undefined) {
            return;
        }
        this._window.on('resize', this._onUpdate);
        this._window.on('move', this._onUpdate);
        this._window.on('ready-to-show', this._onReady);
        this._window.on('closed', this._onClosed);
    }

    private _onUpdate() {
        if (this._window === undefined) {
            return;
        }
        const bounds = this._window.getBounds();
        ServiceWindowState.getSettings().set({
            h: bounds.height,
            max: this._window.isMaximized(),
            w: bounds.width,
            x: bounds.x,
            y: bounds.y,
        }).catch((err: Error) => {
            this._logger.error(err.message);
        });
    }

    private _onReady() {
        this._logger.info('Event "ready-to-show" is emitted');
    }

    private _onClosed(event: Event) {
        this._logger.info('Event "close" is emitted');
    }
}
