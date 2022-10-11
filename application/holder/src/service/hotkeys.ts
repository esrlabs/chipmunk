import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { KeysMap, KeyDescription } from 'platform/types/hotkeys/map';
import { app, globalShortcut, powerMonitor } from 'electron';
import { electron } from '@service/electron';

import * as Events from 'platform/ipc/event';

@DependOn(electron)
@SetupService(services['hotkeys'])
export class Service extends Implementation {
    public override ready(): Promise<void> {
        this.bind = this.bind.bind(this);
        this.resume = this.resume.bind(this);
        this.unbind = this.unbind.bind(this);
        powerMonitor.on('resume', this.resume);
        powerMonitor.on('shutdown', this.unbind);
        app.on('browser-window-blur', this.unbind);
        app.on('browser-window-focus', this.bind);
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        app.removeListener('browser-window-blur', this.unbind);
        app.removeListener('browser-window-focus', this.bind);
        powerMonitor.removeListener('shutdown', this.unbind);
        powerMonitor.removeListener('resume', this.resume);
        this.unbind();
        return Promise.resolve();
    }

    protected bind(): void {
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
                }
            });
        });
    }

    protected unbind(): void {
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
                globalShortcut.isRegistered(shortcut) && globalShortcut.unregister(shortcut);
            });
        });
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
