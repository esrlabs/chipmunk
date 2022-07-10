import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { Listener } from './hotkeys/listener';
import { KeysMap, getKeyByUuid, Requirement, getKeyByAlias } from './hotkeys/map';
import { Subscriber, Subscription } from '@platform/env/subscription';
import { listener } from '@ui/service/listener';
import { ilc, Services } from '@service/ilc';
import { unique } from '@platform/env/sequence';
import { components } from '@env/decorators/initial';
import { RecentActionsMini } from '@ui/elements/recent.mini/component';
import { Vertical, Horizontal } from '@ui/service/pupup';

@SetupService(services['hotkeys'])
export class Service extends Implementation {
    private _listener!: Listener;
    private _subscriber: Subscriber = new Subscriber();
    private _services!: Services;
    private _handlers: Map<string, Map<string, () => void>> = new Map();

    public override ready(): Promise<void> {
        const channel = ilc.channel(this.getName(), this.log());
        this._services = ilc.services(this.getName(), this.log());
        this._listener = new Listener(KeysMap);
        this._subscriber.register(
            channel.session.change(() => {
                this.check().session();
            }),
        );
        this._subscriber.register(
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
        this._subscriber.register(
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
        this._subscriber.register(
            listener.listen('keydown', window, () => {
                this.check().inputs();
                return true;
            }),
        );
        this._subscriber.register(
            listener.listen('mouseup', window, () => {
                this.check().inputs();
                return true;
            }),
        );
        this._subscriber.register(
            this.register('?', () => {
                this._services.ui.popup.open({
                    component: {
                        factory: components.get('app-dialogs-hotkeys'),
                        inputs: {},
                    },
                    closeOnKey: '*',
                });
            }),
        );
        this._subscriber.register(
            this.register('Ctrl + P', () => {
                this._services.ui.popup.open({
                    component: {
                        factory: components.get('app-recent-actions-mini'),
                        inputs: {},
                    },
                    position: {
                        vertical: Vertical.top,
                        horizontal: Horizontal.center,
                    },
                    closeOnKey: 'Escape',
                    width: 450,
                });
            }),
        );
        this.check().all();
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this._subscriber.unsubscribe();
        this._listener.destroy();
        return Promise.resolve();
    }

    public register(alias: string, handler: () => void): Subscription {
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
                setTimeout(() => {
                    if (document.activeElement === null) {
                        return;
                    }
                    const tag: string = document.activeElement.tagName.toLowerCase();
                    if (['input', 'textarea'].indexOf(tag) !== -1) {
                        this._listener.requirement(Requirement.NoInput).deactivate();
                    } else {
                        this._listener.requirement(Requirement.NoInput).activate();
                    }
                }, 150);
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
}
export interface Service extends Interface {}
export const hotkeys = register(new Service());
