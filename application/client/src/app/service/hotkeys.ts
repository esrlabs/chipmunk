import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from '@platform/entity/service';
import { services } from '@register/services';
import { Listener } from './hotkeys/listener';
import { KeysMap, getKeyByUuid, Requirement, getKeyByAlias } from '@platform/types/hotkeys/map';
import { Subscription } from '@platform/env/subscription';
import { listener } from '@ui/service/listener';
import { ilc, Services } from '@service/ilc';
import { unique } from '@platform/env/sequence';
import { components } from '@env/decorators/initial';
import { Vertical, Horizontal } from '@ui/service/popup';
import { env } from '@service/env';
import { Action as FileAnyAction } from '@service/actions/file.any';
import { Action as SettingsAction } from '@service/actions/settings';
import { Action as ExitAction } from '@service/actions/exit';

import * as Events from '@platform/ipc/event/index';
import * as Requests from '@platform/ipc/request';

enum BindingState {
    Bound,
    Bounding,
    Unbound,
    Unbounding,
    NotInited,
}

@DependOn(env)
@SetupService(services['hotkeys'])
export class Service extends Implementation {
    private _listener!: Listener;
    private _services!: Services;
    private _handlers: Map<string, Map<string, () => void>> = new Map();
    private _recent: {
        inputsUpdateState: number;
        remoteBinding: BindingState;
    } = {
        inputsUpdateState: -1,
        remoteBinding: BindingState.NotInited,
    };

    public override ready(): Promise<void> {
        const channel = ilc.channel(this.getName(), this.log());
        this._services = ilc.services(this.getName(), this.log());
        this._listener = new Listener(KeysMap);
        this.register(
            channel.session.change(() => {
                this.check().session();
            }),
        );
        this.register(
            Events.IpcEvent.subscribe<Events.Hotkey.Emit.Event>(
                Events.Hotkey.Emit.Event,
                (event) => {
                    const target = getKeyByAlias(event.code);
                    if (target === undefined) {
                        this.log().warn(`Recieved unknown hotkey: ${event.code}`);
                        return;
                    }
                    this._listener.emit(target.uuid);
                },
            ),
        );
        this.register(
            this._listener.subject.subscribe((uuid: string) => {
                const key = getKeyByUuid(uuid);
                if (key === undefined) {
                    return;
                }
                const handlers = this._handlers.get(key.alias);
                if (handlers === undefined) {
                    return;
                }
                handlers.forEach((handler) => handler());
            }),
        );
        this.register(
            listener.listen('focus', window, () => {
                this.check().inputs();
                return true;
            }),
        );
        this.register(
            listener.listen('blur', window, () => {
                this.remote().unbind();
                return true;
            }),
        );
        this.register(
            listener.listen(
                'keyup',
                window,
                (event: KeyboardEvent) => {
                    return this._listener.emit(event);
                },
                {
                    priority: 100,
                },
            ),
        );
        this.register(
            listener.listen('keydown', window, () => {
                this.check().inputs();
                return true;
            }),
        );
        this.register(
            listener.listen('mouseup', window, () => {
                this.check().inputs();
                return true;
            }),
        );
        this.register(
            this.listen('?', () => {
                this._services.ui.popup.open({
                    component: {
                        factory: components.get('app-dialogs-hotkeys'),
                        inputs: {},
                    },
                    closeOnKey: '*',
                    uuid: '?',
                    size: { width: 500 },
                });
            }),
        );
        this.register(
            this.listen('Ctrl + G', () => {
                if (this._services.system.session.active().session() === undefined) {
                    return;
                }
                this._services.ui.popup.open({
                    component: {
                        factory: components.get('app-dialogs-jumpto'),
                        inputs: {},
                    },
                    position: {
                        vertical: Vertical.top,
                        horizontal: Horizontal.center,
                    },
                    closeOnKey: 'Escape',
                    size: { width: 350 },
                    uuid: 'Ctrl + G',
                    blur: false,
                });
            }),
        );
        this.register(
            this.listen('Ctrl + P', () => {
                this._services.ui.popup.open({
                    component: {
                        factory: components.get('app-navigator'),
                        inputs: {},
                    },
                    position: {
                        vertical: Vertical.top,
                        horizontal: Horizontal.center,
                    },
                    closeOnKey: 'Escape',
                    size: { width: 450 },
                    uuid: 'Ctrl + P',
                });
            }),
        );
        this.register(
            this.listen('Ctrl + O', () => {
                new FileAnyAction().apply().catch((err: Error) => {
                    this.log().error(`Fail to call action FileAnyAction; error: ${err.message}`);
                });
            }),
        );
        this.register(
            this.listen('Ctrl + ,', () => {
                new SettingsAction().apply().catch((err: Error) => {
                    this.log().error(`Fail to call action SettingsAction; error: ${err.message}`);
                });
            }),
        );
        this.register(
            this.listen('Ctrl + Q', () => {
                new ExitAction().apply().catch((err: Error) => {
                    this.log().error(`Fail to call action ExitAction; error: ${err.message}`);
                });
            }),
        );
        this.check().all();
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        this._listener.destroy();
        return Promise.resolve();
    }

    public listen(alias: string, handler: () => void): Subscription {
        const key = getKeyByAlias(alias);
        if (key === undefined) {
            throw new Error(`Hotkey ${alias} isn't found`);
        }
        let handlers = this._handlers.get(alias);
        if (handlers === undefined) {
            handlers = new Map<string, () => void>();
        }
        const uuid = unique();
        handlers.set(uuid, handler);
        this._handlers.set(alias, handlers);
        return new Subscription(alias, () => {
            const handlers = this._handlers.get(alias);
            if (handlers === undefined) {
                return;
            }
            handlers.delete(uuid);
        });
    }

    protected check(): {
        inputs(): void;
        session(): void;
        all(): void;
    } {
        return {
            inputs: (): void => {
                // We have to use here litle delay, because some angular material components makes changes
                // asynch. To catch last state of components we have to let "them" update itselfs
                clearTimeout(this._recent.inputsUpdateState);
                this._recent.inputsUpdateState = setTimeout(() => {
                    this._recent.inputsUpdateState = -1;
                    if (document.activeElement === null) {
                        return;
                    }
                    const tag: string = document.activeElement.tagName.toLowerCase();
                    if (['input', 'textarea'].indexOf(tag) !== -1) {
                        this._listener.requirement(Requirement.NoInput).deactivate();
                        this.remote().unbind();
                    } else {
                        this._listener.requirement(Requirement.NoInput).activate();
                        this.remote().bind();
                    }
                }, 150) as unknown as number;
            },
            session: (): void => {
                const active = this._services.system.session.active().session();
                if (active === undefined) {
                    this._listener.requirement(Requirement.Session).deactivate();
                } else {
                    this._listener.requirement(Requirement.Session).activate();
                }
            },
            all: (): void => {
                this.check().inputs();
                this.check().session();
            },
        };
    }

    protected remote(): {
        bind(): void;
        unbind(): void;
    } {
        return {
            bind: (): void => {
                if (
                    [BindingState.Bound, BindingState.Bounding].includes(this._recent.remoteBinding)
                ) {
                    return;
                }
                this._recent.remoteBinding = BindingState.Bounding;
                Requests.IpcRequest.send<Requests.Hotkey.On.Response>(
                    Requests.Hotkey.On.Response,
                    new Requests.Hotkey.On.Request(),
                )
                    .then((response) => {
                        if (response.error !== undefined && response.error !== '') {
                            this.log().error(
                                `Fail to activate listener of hotkeys: ${response.error}`,
                            );
                            this._recent.remoteBinding = BindingState.NotInited;
                        } else {
                            this._recent.remoteBinding = BindingState.Bound;
                        }
                    })
                    .catch((err: Error) => {
                        this.log().error(
                            `Fail send request to activate listener of hotkeys: ${err.message}`,
                        );
                        this._recent.remoteBinding = BindingState.NotInited;
                    });
            },
            unbind: (): void => {
                if (
                    [BindingState.Unbound, BindingState.Unbounding].includes(
                        this._recent.remoteBinding,
                    )
                ) {
                    return;
                }
                this._recent.remoteBinding = BindingState.Unbounding;
                Requests.IpcRequest.send<Requests.Hotkey.Off.Response>(
                    Requests.Hotkey.Off.Response,
                    new Requests.Hotkey.Off.Request(),
                )
                    .then((response) => {
                        if (response.error !== undefined && response.error !== '') {
                            this.log().error(
                                `Fail to deactivate listener of hotkeys: ${response.error}`,
                            );
                            this._recent.remoteBinding = BindingState.NotInited;
                        } else {
                            this._recent.remoteBinding = BindingState.Unbound;
                        }
                    })
                    .catch((err: Error) => {
                        this.log().error(
                            `Fail send request to deactivate listener of hotkeys: ${err.message}`,
                        );
                        this._recent.remoteBinding = BindingState.NotInited;
                    });
            },
        };
    }
}
export interface Service extends Interface {}
export const hotkeys = register(new Service());
