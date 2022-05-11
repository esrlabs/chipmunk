import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { ilc, Emitter, Channel, Declarations, Services } from '@service/ilc';
import { TabsService, ITabAPI, ITab } from '@elements/tabs/service';
import { Session } from './session/session';
import { LockToken } from '@platform/env/lock.token';
import { components } from '@env/decorators/initial';
import { TargetFile } from '@platform/types/files';
import { TabControls } from './session/tab';

import { Render } from '@schema/render';
import { getRenderFor } from '@schema/render/tools';

export { Session, TabControls };

@SetupService(services['session'])
export class Service extends Implementation {
    private _emitter!: Emitter;
    private _channel!: Channel;
    private _services!: Services;
    private _active: Session | undefined;
    private _sessions: Map<string, Session> = new Map();
    private _tabs: TabsService = new TabsService();
    private _locker: LockToken = LockToken.simple(true);

    public override ready(): Promise<void> {
        this._emitter = ilc.emitter(this.getName(), this.log());
        this._channel = ilc.channel(this.getName(), this.log());
        this._services = ilc.services(this.getName(), this.log());
        this._channel.system.ready(() => {
            this.log().debug(`Session is unlocked`);
            this._locker.unlock();
        });
        this._channel.ux.hotkey(this._onHotKey.bind(this));
        this._tabs.getObservable().active.subscribe((next) => {
            const session = this._sessions.get(next.uuid);
            this._active = session;
            this._emitter.session.change(
                this._active === undefined ? undefined : this._active.uuid(),
            );
        });
        return Promise.resolve();
    }

    private _onHotKey(event: Declarations.HotkeyEvent) {
        // if (this._active === undefined) {
        //     return;
        // }
        // const service: TabsService | undefined = this._sessions.get(this._active);
        // if (service === undefined) {
        //     return;
        // }
        // LayoutStateService.toolbarMax();
        // service.setActive(UUIDs.search);
    }

    public add(): {
        empty: (render: Render<unknown>) => Promise<Session>;
        file: (file: TargetFile, render: Render<unknown>) => Promise<Session>;
        tab: (tab: ITab) => void;
    } {
        const binding = (uuid: string, session: Session, caption: string) => {
            this._sessions.set(uuid, session);
            session.bind(
                this._tabs.add({
                    uuid: uuid,
                    content: {
                        factory: components.get('app-views-workspace'),
                        inputs: {
                            session: session,
                        },
                    },
                    name: caption,
                    active: true,
                }),
            );
            this._emitter.session.change(uuid);
        };
        return {
            empty: (render: Render<unknown>): Promise<Session> => {
                if (this._locker.isLocked()) {
                    return Promise.reject(new Error(`Sessions aren't available yet`));
                }
                return new Promise((resolve, reject) => {
                    const session = new Session(render);
                    session
                        .init({})
                        .then((uuid: string) => {
                            binding(uuid, session, 'Empty');
                            resolve(session);
                        })
                        .catch((err: Error) => {
                            this.log().error(`Fail to add session; error: ${err.message}`);
                            reject(err);
                        });
                });
            },
            file: (file: TargetFile, render: Render<unknown>): Promise<Session> => {
                if (this._locker.isLocked()) {
                    return Promise.reject(new Error(`Sessions aren't available yet`));
                }
                return new Promise((resolve, reject) => {
                    const session = new Session(render);
                    session
                        .init({
                            file,
                        })
                        .then((uuid: string) => {
                            binding(uuid, session, file.name);
                            resolve(session);
                        })
                        .catch((err: Error) => {
                            this.log().error(`Fail to add session; error: ${err.message}`);
                            reject(err);
                        });
                });
            },
            tab: (tab: ITab): void => {
                if (tab.content !== undefined) {
                    tab.content.inputs = tab.content.inputs === undefined ? {} : tab.content.inputs;
                    tab.content.inputs.tab = new TabControls(tab, this._tabs);
                }
                this._tabs.add(tab);
            },
        };
    }

    public getTabsService(): TabsService {
        return this._tabs;
    }

    public active(): Session | undefined {
        return this._active === undefined ? undefined : this._active;
    }
}
export interface Service extends Interface {}
export const session = register(new Service());
