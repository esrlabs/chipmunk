import { Define, Implementation, Interface } from 'platform/entity/controller';
import { services } from '@register/services';
import { paths } from '@service/paths';
import { BrowserWindow } from 'electron';
import { Implementation as ElectronIPCTransport } from './transport';
import { scope } from 'platform/env/scope';
import { system } from 'platform/modules/system';
import { Transport } from 'platform/ipc/transport';
import { Settings, Window as WindowSettings } from './window/settings';
import { SettingsHolder, settingsFactory } from '@controller/settings';
import { envvars } from '@loader/envvars';
import { ChipmunkGlobal } from '@register/global';

import * as path from 'path';
import * as Events from 'platform/ipc/event';

declare const global: ChipmunkGlobal;

@Define({ name: 'Window', parent: services['electron'], accessor: system.getServicesAccessor() })
export class Window extends Implementation {
    private _window: BrowserWindow | undefined;
    private _ipc: ElectronIPCTransport | undefined;
    private _settings!: SettingsHolder<WindowSettings>;

    public async create(): Promise<void> {
        this._settings = settingsFactory(new Settings());
        await this._settings.read();
        this._window = new BrowserWindow({
            title: `Chipmunk`,
            icon: (() => {
                switch (process.platform) {
                    case 'linux':
                        return path.resolve(paths.getResources(), 'icons/png/icon.png');
                    case 'win32':
                        return path.resolve(paths.getResources(), 'icons/ico/icon.ico');
                }
                return undefined;
            })(),
            width: this._settings.get().width,
            height: this._settings.get().height,
            x: this._settings.get().x,
            y: this._settings.get().y,
            webPreferences: {
                preload: path.resolve(paths.getPreload(), 'preload.js'),
                contextIsolation: true,
                devTools: true,
                webviewTag: true,
                spellcheck: false,
                sandbox: true,
                allowRunningInsecureContent: true,
            },
        });
        this._ipc = new ElectronIPCTransport(this._window);
        this._window.on('resize', this._resize.bind(this));
        this._window.on('move', this._resize.bind(this));
        this._window.once('close', (event: Event) => {
            this.log().debug(`Closing of browser window is prevented`);
            event.preventDefault();
            event.returnValue = false;
            global.application
                .shutdown('onBrowserWindowClose')
                .close()
                .catch((err: Error) => {
                    this.log().error(
                        `Fail to trigger closing of application; error: ${err.message}`,
                    );
                });
        });
        scope.setTransport(this._ipc);
        Events.IpcEvent.subscribe(
            Events.State.Client.Event,
            (/*_event: Events.State.Client.Event*/) => {
                Events.IpcEvent.emit(
                    new Events.State.Backend.Event({
                        state: Events.State.Backend.State.Ready,
                        job: 'ready',
                    }),
                );
            },
        );
        this._window.loadFile(path.resolve(paths.getClient(), 'index.html'));
        envvars.get().CHIPMUNK_DEVELOPING_MODE && this._window.webContents.openDevTools();
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        if (this._window !== undefined) {
            this._window.removeAllListeners();
            this._window.destroy();
            this.log().debug(`BrowserWindow was destroyed.`);
        }
        if (this._ipc !== undefined) {
            this._ipc.destroy();
            this.log().debug(`ICP transport was destroyed.`);
        }
        this._window = undefined;
        this._ipc = undefined;
        return Promise.resolve();
    }

    public instance(): {
        created(): boolean;
        focused(): boolean;
        get(): BrowserWindow;
    } {
        return {
            created: (): boolean => {
                return this._window !== undefined;
            },
            focused: (): boolean => {
                return this.instance().get().isFocused();
            },
            get: (): BrowserWindow => {
                if (this._window === undefined) {
                    throw new Error(this.log().error(`BrowserWindow isn't created`));
                }
                return this._window;
            },
        };
    }

    public ipc(): Transport {
        if (this._ipc === undefined) {
            throw new Error(`IPC transport isn't inited`);
        }
        return this._ipc;
    }

    private _resize() {
        if (this._window === undefined) {
            return;
        }
        this._settings.setFrom(this._window.getBounds());
    }
}
export interface Window extends Interface {}
