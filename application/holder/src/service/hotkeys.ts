import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { KeysMap, KeyDescription } from 'platform/types/hotkeys/map';
import { app, globalShortcut, powerMonitor, BrowserWindow } from 'electron';
import { electron } from '@service/electron';
import { CancelablePromise } from 'platform/env/promise';

import * as Events from 'platform/ipc/event';
import * as Requests from 'platform/ipc/request';

@DependOn(electron)
@SetupService(services['hotkeys'])
export class Service extends Implementation {
    protected window!: BrowserWindow;

    public override ready(): Promise<void> {
        this.listener().bind();
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
                            this.bind();
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
                            this.unbind();
                            resolve(new Requests.Hotkey.Off.Response({ error: undefined }));
                        });
                    },
                ),
        );
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.listener().unbind();
        this.unbind();
        return Promise.resolve();
    }

    protected listener(): {
        bind(): void;
        unbind(): void;
    } {
        return {
            bind: (): void => {
                this.bind = this.bind.bind(this);
                this.resume = this.resume.bind(this);
                this.unbind = this.unbind.bind(this);
                powerMonitor.addListener('resume', this.resume);
                powerMonitor.addListener('shutdown', this.unbind);
                app.addListener('browser-window-blur', this.unbind);
                app.addListener('browser-window-focus', this.bind);
                app.addListener('before-quit', () => {
                    this.listener().unbind();
                    this.unbind();
                });
                this.window = electron.window().instance().get();
                this.window.addListener('blur', this.unbind);
                this.window.addListener('focus', this.resume);
            },
            unbind: (): void => {
                app.removeListener('browser-window-blur', this.unbind);
                app.removeListener('browser-window-focus', this.bind);
                powerMonitor.removeListener('shutdown', this.unbind);
                powerMonitor.removeListener('resume', this.resume);
                this.window.removeListener('blur', this.unbind);
                this.window.removeListener('focus', this.resume);
            },
        };
    }

    protected bind(): void {
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
        listeners > 0 && this.log().debug(`Activated ${listeners} hotkeys listeners`);
    }

    protected unbind(): void {
        let listeners = 0;
        KeysMap.forEach((key) => {
            if (key.client) {
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
        listeners > 0 && this.log().debug(`Deactivated ${listeners} hotkeys listeners`);
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
