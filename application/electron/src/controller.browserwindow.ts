import * as Url from 'url';

import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';

import Logger from '../platform/node/src/env.logger';

import EventEmitter from '../platform/cross/src/emitter';
import { IWindowState } from './service.window.state.scheme';

import ServicePackage from './service.package';
import ServicePath from './service.paths';
import ServiceSettings from './service.settings';
import ServiceWindowState from './service.window.state';

export default class ControllerBrowserWindow extends EventEmitter {

    public static Events = {
        closed: Symbol(),
        created: Symbol(),
        ready: Symbol(),
    };

    private _window: BrowserWindow | null = null;
    private _guid: string;
    private _logger: Logger = new Logger('ControllerBrowserWindow');

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
        this._window = null;
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
            this._window.loadURL(Url.format({
                pathname: ServicePath.resoveHomeFolder(ServiceSettings.get().client.indexHtml),
			    protocol: 'file:',
			    slashes: true,
            }) + `?v${ServicePackage.get().version}`);
            state.max && this._window.maximize();
            this._bind();
            this.emit(ControllerBrowserWindow.Events.created);
        });
    }

    private _bind() {
        if (this._window === null) {
            return;
        }
        this._window.on('resize', this._onUpdate);
        this._window.on('move', this._onUpdate);
        this._window.on('close', this._onUpdate);
        this._window.on('ready-to-show', this._onReady);
        this._window.on('closed', this._onClosed);
    }

    private _onUpdate() {
        if (this._window === null) {
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
