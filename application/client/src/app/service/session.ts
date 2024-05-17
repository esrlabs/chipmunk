import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from '@platform/entity/service';
import { services } from '@register/services';
import { ilc, Emitter, Channel } from '@service/ilc';
import { TabsService, ITab, ITabAPI } from '@elements/tabs/service';
import { Base } from './session/base';
import { Session } from './session/session';
import { UnboundTab } from './session/unbound';
import { LockToken } from '@platform/env/lock.token';
import { components } from '@env/decorators/initial';
import { TabControls } from './session/tab';
import { unique } from '@platform/env/sequence';
import { history } from '@service/history';
import { Render } from '@schema/render';
import { File } from '@platform/types/files';
import { Observe } from '@platform/types/observe';
import { getRender } from '@schema/render/tools';
import { TabObserve } from '@tabs/observe/component';
import { recent } from '@service/recent';
import { bridge } from '@service/bridge';

import * as Factory from '@platform/types/observe/factory';

export { Session, TabControls, UnboundTab, Base };

@DependOn(history)
@SetupService(services['session'])
export class Service extends Implementation {
    private _emitter!: Emitter;
    private _channel!: Channel;
    private _active: Base | undefined;
    private _sessions: Map<string, Base> = new Map();
    private _tabs: TabsService = new TabsService();
    private _locker: LockToken = LockToken.simple(true);

    public override ready(): Promise<void> {
        this._emitter = ilc.emitter(this.getName(), this.log());
        this._channel = ilc.channel(this.getName(), this.log());
        this._channel.system.ready(() => {
            this.log().debug(`Session is unlocked`);
            this._locker.unlock();
        });
        this._tabs.subjects.get().active.subscribe((next) => {
            this._active = this._sessions.get(next.uuid);
            this._emitter.session.change(
                this._active === undefined ? undefined : this._active.uuid(),
            );
        });
        this._tabs.subjects.get().removed.subscribe(this.kill.bind(this));
        return Promise.resolve();
    }

    public override async destroy(): Promise<void> {
        this._emitter.destroy();
        this._channel.destroy();
        await super.destroy();
        if (this._sessions.size > 0) {
            throw new Error(
                `Destroy is called with existed sessions. Count of opened session ${this._sessions.size}`,
            );
        }
    }

    public async closeAllSessions(): Promise<void> {
        this.log().debug(`All sessions will be closed`);
        for (const session of Array.from(this._sessions.values())) {
            const uuid = session.uuid();
            await this.kill(uuid).catch((err: Error) => {
                this.log().error(`Fail to close session "${uuid}": ${err.message}`);
            });
        }
        this.log().debug(`All sessions are closed`);
    }

    public kill(uuid: string): Promise<void> {
        return new Promise((resolve) => {
            const session = this._sessions.get(uuid);
            if (session === undefined) {
                return resolve();
            }
            this._emitter.session.closing(session);
            session
                .destroy()
                .catch((err: Error) => {
                    this.log().error(`Fail to remove session: ${err.message}`);
                })
                .finally(() => {
                    this._sessions.delete(uuid);
                    this._emitter.session.closed(uuid);
                    resolve();
                });
        });
    }

    public add(bind = true): {
        empty: (render: Render<unknown>) => Promise<Session>;
        unbound: (opts: {
            tab: ITab;
            sidebar?: boolean;
            toolbar?: boolean;
            uuid?: string;
        }) => UnboundTab;
        tab: (tab: ITab) => ITabAPI | undefined;
    } {
        const binding = (uuid: string, session: Session, caption: string) => {
            this._sessions.set(uuid, session);
            if (!bind) {
                return;
            }
            this.bind(uuid, caption);
            this._emitter.session.open(session);
        };
        return {
            empty: (render: Render<unknown>): Promise<Session> => {
                if (this._locker.isLocked()) {
                    return Promise.reject(new Error(`Sessions aren't available yet`));
                }
                return new Promise((resolve, reject) => {
                    this.create(render)
                        .then((session: Session) => {
                            binding(session.uuid(), session, 'Empty');
                            resolve(session);
                        })
                        .catch((err: Error) => {
                            this.log().error(`Fail to add session; error: ${err.message}`);
                            session
                                .destroy()
                                .catch((err) =>
                                    this.log().warn(`Fail to destroy session: ${err.message}`),
                                );
                            reject(err);
                        });
                });
            },
            tab: (tab: ITab): ITabAPI | undefined => {
                if (tab.uuid !== undefined && this._tabs.has(tab.uuid)) {
                    this._tabs.setActive(tab.uuid);
                    return undefined;
                } else {
                    if (tab.content !== undefined) {
                        tab.content.inputs =
                            tab.content.inputs === undefined ? {} : tab.content.inputs;
                        tab.content.inputs.tab = new TabControls(tab, this._tabs);
                    }
                    return this._tabs.add(tab);
                }
            },
            unbound: (opts: {
                tab: ITab;
                sidebar?: boolean;
                toolbar?: boolean;
                uuid?: string;
            }): UnboundTab => {
                if (opts.uuid !== undefined && this._sessions.has(opts.uuid)) {
                    throw new Error(this.log().error(`Tab "${opts.uuid}" already exists`));
                }
                opts.uuid = opts.uuid !== undefined ? opts.uuid : unique();
                opts.tab.uuid = opts.tab.uuid !== undefined ? opts.tab.uuid : opts.uuid;
                const unbound = new UnboundTab(opts);
                this._sessions.set(unbound.uuid(), unbound);
                unbound.bind(this._tabs.add(opts.tab));
                return unbound;
            },
        };
    }

    public bind(uuid: string, caption: string, makeActive = true): Error | undefined {
        const session = this._sessions.get(uuid);
        if (session === undefined) {
            return new Error(`Session doesn't exist`);
        }
        if (!this._tabs.has(uuid)) {
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
        }
        makeActive && this._emitter.session.change(uuid);
        return undefined;
    }

    public getTabsService(): TabsService {
        return this._tabs;
    }

    public active(): {
        base(): Base | undefined;
        session(): Session | undefined;
        unbound(): UnboundTab | undefined;
        is(uuid: string): boolean;
    } {
        return {
            base: (): Base | undefined => {
                return this._active;
            },
            session: (): Session | undefined => {
                return this._active instanceof Session ? this._active : undefined;
            },
            unbound: (): UnboundTab | undefined => {
                return this._active instanceof UnboundTab ? this._active : undefined;
            },
            is: (uuid: string): boolean => {
                return this._active === undefined ? false : this._active.uuid() === uuid;
            },
        };
    }

    public get(uuid: string): Session | undefined {
        const smth = this._sessions.get(uuid);
        return smth instanceof Session ? smth : undefined;
    }

    public initialize(): {
        suggest(filename: string, session?: Session): Promise<string | undefined>;
        auto(observe: Observe, session?: Session): Promise<string | undefined>;
        configure(observe: Observe, session?: Session): Promise<string | undefined>;
        observe(observe: Observe, session?: Session): Promise<string>;
        multiple(files: File[]): Promise<string | undefined>;
    } {
        return {
            suggest: (filename: string, session?: Session): Promise<string | undefined> => {
                return bridge
                    .files()
                    .isBinary(filename)
                    .then((binary: boolean) => {
                        if (!binary) {
                            return this.initialize().observe(
                                new Factory.File()
                                    .type(Factory.FileType.Text)
                                    .asText()
                                    .file(filename)
                                    .get(),
                                session,
                            );
                        } else {
                            return this.initialize().configure(
                                new Factory.File()
                                    .type(Factory.FileType.Binary)
                                    .file(filename)
                                    .get(),
                                session,
                            );
                        }
                    });
            },
            auto: (observe: Observe, session?: Session): Promise<string | undefined> => {
                return observe.locker().is()
                    ? this.initialize().observe(observe, session)
                    : this.initialize().configure(observe, session);
            },
            configure: (observe: Observe, session?: Session): Promise<string | undefined> => {
                return new Promise((resolve) => {
                    const api = this.add().tab({
                        name: observe.origin.title(),
                        content: {
                            factory: TabObserve,
                            inputs: TabObserve.inputs({
                                observe,
                                api: {
                                    finish: (observe: Observe): Promise<void> => {
                                        return new Promise((success, failed) => {
                                            this.initialize()
                                                .observe(observe, session)
                                                .then((session) => {
                                                    success();
                                                    api?.close();
                                                    resolve(session);
                                                })
                                                .catch((err: Error) => {
                                                    failed(err);
                                                });
                                        });
                                    },
                                    cancel: (): void => {
                                        api?.close();
                                        resolve(undefined);
                                    },
                                    tab: (): TabControls => {
                                        return api as unknown as TabControls;
                                    },
                                },
                            }),
                        },
                        active: true,
                    });
                });
            },
            observe: async (observe: Observe, existed?: Session): Promise<string> => {
                const render = getRender(observe);
                if (render instanceof Error) {
                    throw render;
                }
                const session =
                    existed !== undefined ? existed : await this.add(false).empty(render);
                return new Promise((resolve, reject) => {
                    session.stream
                        .observe()
                        .start(observe)
                        .then((uuid: string) => {
                            if (existed === undefined) {
                                const error = this.bind(
                                    session.uuid(),
                                    observe.origin.desc().major,
                                    true,
                                );
                                if (error instanceof Error) {
                                    this.log().error(`Fail to bind session: ${error.message}`);
                                }
                                recent.add(observe).catch((err: Error) => {
                                    this.log().error(
                                        `Fail to save action as recent: ${err.message}`,
                                    );
                                });
                            }
                            resolve(uuid);
                        })
                        .catch((err: Error) => {
                            if (existed !== undefined) {
                                return reject(err);
                            }
                            this.kill(session.uuid())
                                .catch((closeErr: Error) => {
                                    this.log().error(`Fail to close session: ${closeErr.message}`);
                                })
                                .finally(() => {
                                    reject(err);
                                });
                        });
                });
            },
            multiple: (files: File[]): Promise<string | undefined> => {
                return new Promise((resolve, reject) => {
                    const api = this.add().tab({
                        name: 'Multiple Files',
                        content: {
                            factory: components.get('app-tabs-source-multiple-files'),
                            inputs: {
                                files,
                                setTitle: (title: string) => {
                                    api?.setTitle(title);
                                },
                                done: (observe: Observe) => {
                                    this.initialize()
                                        .observe(observe)
                                        .then((session) => {
                                            resolve(session);
                                        })
                                        .catch((err: Error) => {
                                            this.log().error(
                                                `Fail to setup observe: ${err.message}`,
                                            );
                                            reject(err);
                                        })
                                        .finally(() => {
                                            api?.close();
                                        });
                                },
                                cancel: () => {
                                    api?.close();
                                    resolve(undefined);
                                },
                            },
                        },
                        active: true,
                        closable: true,
                    });
                });
            },
        };
    }

    protected create(render: Render<unknown>): Promise<Session> {
        const session = new Session(render);
        return session.init().then((_uuid: string) => {
            this._emitter.session.created(session);
            return session;
        });
    }
}
export interface Service extends Interface {}
export const session = register(new Service());
