import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { KeysMap, KeyDescription, Requirement } from 'platform/types/hotkeys/map';
import { app, globalShortcut, powerMonitor, BrowserWindow } from 'electron';
import { electron } from '@service/electron';
import { CancelablePromise } from 'platform/env/promise';
import { ChipmunkGlobal } from '@register/global';
import { Listeners } from 'platform/env/subscription';

declare const global: ChipmunkGlobal;

import * as Events from 'platform/ipc/event';
import * as Requests from 'platform/ipc/request';

@DependOn(electron)
@SetupService(services['hotkeys'])
export class Service extends Implementation {
    protected window!: BrowserWindow;
    protected listeners: Listeners = new Listeners();

    public override ready(): Promise<void> {
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Hotkey.On.Request,
                    (
                        _request: Requests.Hotkey.On.Request,
                    ): CancelablePromise<Requests.Hotkey.On.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            this.bind([Requirement.NoInput]);
                            resolve(new Requests.Hotkey.On.Response({ error: undefined }));
                        });
                    },
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Hotkey.Off.Request,
                    (
                        _request: Requests.Hotkey.Off.Request,
                    ): CancelablePromise<Requests.Hotkey.Off.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            this.unbind([Requirement.NoInput]);
                            resolve(new Requests.Hotkey.Off.Response({ error: undefined }));
                        });
                    },
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.System.Exit.Request,
                    (
                        _request: Requests.System.Exit.Request,
                    ): CancelablePromise<Requests.System.Exit.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            global.application
                                .shutdown('ClosingWithMenu')
                                .close()
                                .catch((err: Error) => {
                                    this.log().error(`Fail to close: ${err.message}`);
                                });
                            resolve(new Requests.System.Exit.Response());
                        });
                    },
                ),
        );
        this.window = electron.window().instance().get();
        this.listeners.add('blur', this.window, this.unbind.bind(this));
        this.listeners.add('focus', this.window, this.resume.bind(this));
        this.listeners.add('resume', powerMonitor, this.resume.bind(this));
        this.listeners.add('shutdown', powerMonitor, this.unbind.bind(this));
        this.listeners.add('browser-window-created', app, this.bind.bind(this));
        this.listeners.add('browser-window-focus', app, this.bind.bind(this));
        this.listeners.add('browser-window-blur', app, this.unbind.bind(this));
        this.listeners.add('before-quit', app, () => {
            this.listeners.unsubscribe();
            this.unbind();
        });
        this.listeners.subscribe();
        this.bind();
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.listeners.unsubscribe();
        this.unbind();
        return Promise.resolve();
    }

    protected bind(filter?: Requirement[]): void {
        if (this.window === undefined) {
            this.log().debug(`Cannot activete hotkeys because no window available`);
            return;
        }
        if (!this.window.isFocused()) {
            this.log().debug(`Cannot activete hotkeys because window doesn't have a focus`);
            return;
        }
        let listeners = 0;
        KeysMap.forEach((key) => {
            if (key.client) {
                return;
            }
            if (
                filter !== undefined &&
                filter.length > 0 &&
                key.required.find((requirement) => {
                    return filter.indexOf(requirement) !== -1;
                }) === undefined
            ) {
                return;
            }
            const shortcuts = key.shortkeys as { [key: string]: string[] };
            const keys: string[] =
                shortcuts[process.platform] !== undefined
                    ? shortcuts[process.platform]
                    : shortcuts['others'];
            keys.forEach((shortcut) => {
                if (globalShortcut.isRegistered(shortcut)) {
                    return;
                }
                if (!globalShortcut.register(shortcut, this.emit.bind(this, key))) {
                    this.log().warn(
                        `Fail to register key "${shortcut}" for action "${key.alias}" as shortcut.`,
                    );
                } else {
                    listeners += 1;
                }
            });
        });
        listeners > 0 && this.log().verbose(`Activated ${listeners} hotkeys listeners`);
    }

    protected unbind(filter: Requirement[] = []): void {
        if (
            this.window.webContents.devToolsWebContents !== null &&
            this.window.webContents.devToolsWebContents.isFocused()
        ) {
            filter = [];
        }
        let listeners = 0;
        KeysMap.forEach((key) => {
            if (key.client) {
                return;
            }
            if (
                filter.length > 0 &&
                key.required.find((requirement) => {
                    return filter.indexOf(requirement) !== -1;
                }) === undefined
            ) {
                return;
            }
            const shortcuts = key.shortkeys as { [key: string]: string[] };
            const keys: string[] =
                shortcuts[process.platform] !== undefined
                    ? shortcuts[process.platform]
                    : shortcuts['others'];
            keys.forEach((shortcut) => {
                if (globalShortcut.isRegistered(shortcut)) {
                    globalShortcut.unregister(shortcut);
                    listeners += 1;
                }
            });
        });
        listeners > 0 && this.log().verbose(`Deactivated ${listeners} hotkeys listeners`);
    }

    protected resume() {
        if (!electron.window().instance().created()) {
            this.unbind();
        } else if (!electron.window().instance().focused()) {
            this.unbind();
        }
    }

    protected emit(desc: KeyDescription) {
        Events.IpcEvent.emit(
            new Events.Hotkey.Emit.Event({
                code: desc.uuid,
            }),
        );
    }
}
export interface Service extends Interface {}
export const hotkeys = register(new Service());
