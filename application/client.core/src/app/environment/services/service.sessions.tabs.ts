import { TabsService, DockingComponent, DockDef, DocksService, ITab, ITabAPI } from 'chipmunk-client-material';
import { Subscription } from './service.electron.ipc';
import { ControllerSessionTab } from '../controller/controller.session.tab';
import { IService } from '../interfaces/interface.service';
import { Observable, Subject, Subscription as SubscriptionRX } from 'rxjs';
import { IDefaultView } from '../states/state.default';
import { IAPI, IPopup, IComponentDesc } from 'chipmunk.client.toolkit';
import { LayoutPrimiryAreaTabTitleControlsComponent } from '../layout/area.primary/tab-title-controls/component';
import { TabTitleContentService } from '../layout/area.primary/tab-title-controls/service';

import ElectronIpcService, { IPCMessages } from './service.electron.ipc';
import SourcesService from './service.sources';
import HotkeysService from './service.hotkeys';
import PluginsService from './service.plugins';
import PopupsService from './standalone/service.popups';
import OutputRedirectionsService from './standalone/service.output.redirections';
import LayoutStateService from './standalone/service.layout.state';

import * as Toolkit from 'chipmunk.client.toolkit';

export { ControllerSessionTabSearch } from '../controller/controller.session.tab.search';

export type TSessionGuid = string;
export type TSidebarTabOpener = (guid: string, session: string | undefined, silence: boolean) => Error | undefined;
export type TToolbarTabOpener = (guid: string, session: string | undefined, silence: boolean) => Error | undefined;
export type TNotificationOpener = (notification: Toolkit.INotification) => void;

export interface IServiceSubjects {
    onSessionChange: Subject<ControllerSessionTab | undefined>;
    onSessionClosed: Subject<string>;
    onSidebarTitleInjection: Subject<IComponentDesc | undefined>;
}

export class TabsSessionsService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('TabsSessionsService');
    private _sessions: Map<TSessionGuid, ControllerSessionTab> = new Map();
    private _sources: Map<TSessionGuid, number> = new Map();
    private _tabsService: TabsService = new TabsService();
    private _subscriptions: { [key: string]: Subscription | SubscriptionRX | undefined } = { };
    private _currentSessionGuid: string;
    private _sessionsEventsHub: Toolkit.ControllerSessionsEvents = new Toolkit.ControllerSessionsEvents();
    private _sidebarTabOpener: TSidebarTabOpener | undefined;
    private _toolbarTabOpener: TToolbarTabOpener | undefined;
    private _notificationOpener: TNotificationOpener | undefined;

    private _defaults: {
        views: IDefaultView[],
    } = {
        views: [],
    };

    private _subjects: IServiceSubjects = {
        onSessionChange: new Subject<ControllerSessionTab>(),
        onSessionClosed: new Subject<string>(),
        onSidebarTitleInjection: new Subject<IComponentDesc | undefined>(),
    };

    constructor() {
        this.getPluginAPI = this.getPluginAPI.bind(this);
        // Delivering API getter into Plugin Service here to escape from circular dependencies
        // (which will happen if try to access to this service from Plugin Service)
        PluginsService.setPluginAPIGetter(this.getPluginAPI);
        // Listen stream events
        this._subscriptions.onStreamUpdated = ElectronIpcService.subscribe(IPCMessages.StreamUpdated, this._ipc_onStreamUpdated.bind(this));
        this._subscriptions.onSearchUpdated = ElectronIpcService.subscribe(IPCMessages.SearchUpdated, this._ipc_onSearchUpdated.bind(this));
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscriptions.onSessionTabChanged = this._tabsService.getObservable().active.subscribe(this._onSessionTabSwitched.bind(this));
            this._subscriptions.onSessionTabClosed = this._tabsService.getObservable().removed.subscribe(this._onSessionTabClosed.bind(this));
            this._subscriptions.onNewTab = HotkeysService.getObservable().newTab.subscribe(this._onNewTab.bind(this));
            this._subscriptions.onCloseTab = HotkeysService.getObservable().closeTab.subscribe(this._onCloseTab.bind(this));
            this._subscriptions.RenderSessionAddRequest = ElectronIpcService.subscribe(IPCMessages.RenderSessionAddRequest, this._ipc_RenderSessionAddRequest.bind(this));
            OutputRedirectionsService.init(this._currentSessionGuid, {
                onSessionChange: this.getObservable().onSessionChange,
                onSessionClosed: this.getObservable().onSessionClosed,
            });
            resolve();
        });
    }

    public getName(): string {
        return 'TabsSessionsService';
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public setSidebarTabOpener(opener: TSidebarTabOpener) {
        this._sidebarTabOpener = opener;
    }

    public setToolbarTabOpener(opener: TToolbarTabOpener) {
        this._toolbarTabOpener = opener;
    }

    public setNotificationOpener(opener: TNotificationOpener) {
        this._notificationOpener = opener;
    }

    public setDefaultViews(views: IDefaultView[]) {
        this._defaults.views = views;
    }

    public add(): Promise<ControllerSessionTab> {
        return new Promise((resolve, reject) => {
            const guid: string = Toolkit.guid();
            const tabTitleContentService: TabTitleContentService = new TabTitleContentService(guid);
            const session = new ControllerSessionTab({
                guid: guid,
                sessionsEventsHub: this._sessionsEventsHub,
                tabTitleContentService: tabTitleContentService,
            });
            session.init().then(() => {
                this._subscriptions[`onSourceChanged:${guid}`] = session.getObservable().onSourceChanged.subscribe(this._onSourceChanged.bind(this, guid));
                this._sessions.set(guid, session);
                const tabAPI: ITabAPI | undefined = this._tabsService.add({
                    guid: guid,
                    name: 'New',
                    active: true,
                    tabCaptionInjection: {
                        factory: LayoutPrimiryAreaTabTitleControlsComponent,
                        inputs: {
                            service: tabTitleContentService
                        },
                    },
                    content: {
                        factory: DockingComponent,
                        inputs: {
                            service: new DocksService(guid, new DockDef.Container({
                                a: new DockDef.Dock({
                                    caption: this._defaults.views[0].name,
                                    closable: false,
                                    component: {
                                        factory: this._defaults.views[0].component,
                                        inputs: {
                                            session: session,
                                            getTabAPI: (): ITabAPI => {
                                                return tabAPI;
                                            }
                                        }
                                    }
                                })
                            }))
                        }
                    }
                });
                session.setTabAPI(tabAPI);
                this._sessionsEventsHub.emit().onSessionOpen(guid);
                this.setActive(guid);
                resolve(session);
            }).catch((error: Error) => {
                session.destroy().catch((destroyErr: Error) => {
                    this._logger.error(`Fail to destroy incorrectly created session due error: ${destroyErr.message}`);
                }).finally(() => {
                    this._logger.error(`Fail to create new session due error: ${error.message}`);
                    reject(error);
                });
            });
        });
    }

    public getTabsService(): TabsService {
        return this._tabsService;
    }

    public getSessionController(session: string): ControllerSessionTab | Error {
        if (session === undefined) {
            session = this._currentSessionGuid;
        }
        const controller: ControllerSessionTab = this._sessions.get(session);
        if (controller === undefined) {
            return new Error(`Fail to find defiend session "${session}"`);
        }
        return controller;
    }

    public getObservable(): {
        onSessionChange: Observable<ControllerSessionTab | undefined>,
        onSessionClosed: Observable<string>,
        onSidebarTitleInjection: Observable<IComponentDesc | undefined>,
    } {
        return {
            onSessionChange: this._subjects.onSessionChange.asObservable(),
            onSessionClosed: this._subjects.onSessionClosed.asObservable(),
            onSidebarTitleInjection: this._subjects.onSidebarTitleInjection.asObservable(),
        };
    }

    public setActive(guid: string) {
        if (guid === this._currentSessionGuid) {
            return;
        }
        const session: ControllerSessionTab | undefined = this._sessions.get(guid);
        if (session === undefined) {
            return this._logger.warn(`Cannot fild session ${guid}. Cannot make this session active.`);
        }
        session.setActive();
        this._currentSessionGuid = guid;
        this._tabsService.setActive(this._currentSessionGuid);
        ElectronIpcService.send(new IPCMessages.StreamSetActive({ guid: this._currentSessionGuid })).then(() => {
            this._subjects.onSessionChange.next(session);
            this._sessionsEventsHub.emit().onSessionChange(guid);
        }).catch((error: Error) => {
            this._logger.warn(`Fail to send notification about active session due error: ${error.message}`);
        });
    }

    public getActive(): ControllerSessionTab | undefined {
        return this._sessions.get(this._currentSessionGuid);
    }

    public getSessionEventsHub(): Toolkit.ControllerSessionsEvents {
        return this._sessionsEventsHub;
    }

    public getPluginAPI(pluginId: number): IAPI {
        return {
            getIPC: () => {
                const plugin = PluginsService.getPluginById(pluginId);
                if (plugin === undefined) {
                    return undefined;
                }
                return plugin.ipc;
            },
            getActiveSessionId: () => {
                const controller: ControllerSessionTab | undefined = this.getActive();
                return controller === undefined ? undefined : controller.getGuid();
            },
            addOutputInjection: (injection: Toolkit.IComponentInjection, type: Toolkit.EViewsTypes) => {
                const controller: ControllerSessionTab | undefined = this.getActive();
                return controller === undefined ? undefined : controller.addOutputInjection(injection, type);
            },
            removeOutputInjection: (id: string, type: Toolkit.EViewsTypes) => {
                const controller: ControllerSessionTab | undefined = this.getActive();
                return controller === undefined ? undefined : controller.removeOutputInjection(id, type);
            },
            getViewportEventsHub: () => {
                const controller: ControllerSessionTab | undefined = this.getActive();
                return controller === undefined ? undefined : controller.getViewportEventsHub();
            },
            getSessionsEventsHub: () => {
                return this._sessionsEventsHub;
            },
            addPopup: (popup: IPopup) => {
                return PopupsService.add(popup);
            },
            removePopup: (guid: string) => {
                PopupsService.remove(guid);
            },
            setSidebarTitleInjection: (component: IComponentDesc) => {
                this._subjects.onSidebarTitleInjection.next(component);
            },
            openSidebarApp: (appId: string, silence: boolean) => {
                if (this._sidebarTabOpener === undefined) {
                    return;
                }
                LayoutStateService.sidebarMax();
                this._sidebarTabOpener(appId, this._tabsService.getActiveTab().guid, silence);
            },
            openToolbarApp: (appId: string, silence: boolean) => {
                if (this._toolbarTabOpener === undefined) {
                    return;
                }
                LayoutStateService.toolbarMax();
                this._toolbarTabOpener(appId, undefined, silence);
            },
            addNotification: (notification: Toolkit.INotification) => {
                if (this._notificationOpener === undefined) {
                    return;
                }
                this._notificationOpener(notification);
            }
        };
    }

    private _onSourceChanged(guid: string, sourceId: number) {
        if (typeof sourceId !== 'number' || sourceId < 0) {
            return;
        }
        const current: number | undefined = this._sources.get(guid);
        if (current === sourceId) {
            return;
        }
        const name: string | undefined = SourcesService.getSourceName(sourceId);
        if (typeof name !== 'string' || name.trim() === '') {
            return;
        }
        this._sources.set(guid, sourceId);
        this._tabsService.setTitle(guid, name);
    }

    private _onSessionTabSwitched(tab: ITab) {
        this.setActive(tab.guid);
    }

    private _onSessionTabClosed(session: string) {
        // Get session controller
        const controller: ControllerSessionTab = this._sessions.get(session);
        if (controller === undefined) {
            return this._logger.warn(`Fail to destroy session "${session}" because cannot find this session.`);
        }
        controller.destroy().then(() => {
            this._removeSession(session);
            this._logger.env(`Session "${session}" is destroyed`);
        }).catch((error: Error) => {
            this._removeSession(session);
            this._logger.warn(`Fail to destroy session "${session}" due error: ${error.message}`);
        });
    }

    private _removeSession(guid: string) {
        if (this._subscriptions[`onSourceChanged:${guid}`] !== undefined) {
            this._subscriptions[`onSourceChanged:${guid}`].unsubscribe();
        }
        this._sessions.delete(guid);
        if (this._sessions.size === 0) {
            this._subjects.onSessionChange.next(undefined);
            this._sessionsEventsHub.emit().onSessionChange(undefined);
        }
        this._subjects.onSessionClosed.next(guid);
        this._sessionsEventsHub.emit().onSessionClose(guid);
    }

    private _onNewTab() {
        this.add();
    }

    private _onCloseTab() {
        this._tabsService.remove(this._currentSessionGuid);
    }

    private _ipc_RenderSessionAddRequest(message: IPCMessages.RenderSessionAddRequest, response: (message: IPCMessages.TMessage) => void) {
        this.add().then((session: ControllerSessionTab) => {
            response(new IPCMessages.RenderSessionAddResponse({ session: session.getGuid() }));
        }).catch((error: Error) => {
            response(new IPCMessages.RenderSessionAddResponse({ session: '', error: error.message }));
        });
    }

    private _ipc_onStreamUpdated(message: IPCMessages.StreamUpdated) {
        this._sessionsEventsHub.emit().onStreamUpdated({ session: message.guid, rows: message.rowsCount });
    }

    private _ipc_onSearchUpdated(message: IPCMessages.SearchUpdated) {
        this._sessionsEventsHub.emit().onSearchUpdated({ session: message.guid, rows: message.rowsCount });
    }

}

export default (new TabsSessionsService());


        /*
        this.tabsService.add({
            name: 'Tab 2 (2)',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Dock({ caption: 'Dock 1' }),
                        b: new DockDef.Dock({ caption: 'Dock 2' })
                    }))
                }
            }
        });
        this.tabsService.add({
            name: 'Tab 3 (4)',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Container({
                            a: new DockDef.Dock({ caption: '1' }),
                            b: new DockDef.Dock({ caption: '2' })
                        }),
                        b: new DockDef.Container({
                            a: new DockDef.Dock({ caption: '3' }),
                            b: new DockDef.Dock({ caption: '4' })
                        })
                    }))
                }
            }
        });
        this.tabsService.add({
            name: 'Tab 4 (5)',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Container({
                            a: new DockDef.Dock({ caption: 'Dock 1' }),
                            b: new DockDef.Dock({ caption: 'Dock 2' })
                        }),
                        b: new DockDef.Container({
                            a: new DockDef.Dock({ caption: 'Dock 3' }),
                            b: new DockDef.Container({
                                a: new DockDef.Dock({ caption: 'Dock 4' }),
                                b: new DockDef.Dock({ caption: 'Dock 5' })
                            })
                        })
                    }))
                }
            }
        });
        this.tabsService.add({
            name: 'Tab 5',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Dock({ caption: 'Dock 1' })
                    }))
                }
            }
        });
        */
