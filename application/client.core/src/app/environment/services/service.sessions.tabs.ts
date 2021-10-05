import { TabsService, ITab, ITabAPI } from 'chipmunk-client-material';
import { Subscription } from './service.electron.ipc';
import { Session } from '../controller/session/session';
import { IService } from '../interfaces/interface.service';
import { Subject, Subscription as SubscriptionRX } from 'rxjs';
import { IDefaultView } from '../states/state.default';
import { IAPI, IPopup, IComponentDesc, ISettingsAPI } from 'chipmunk.client.toolkit';
import { copyTextToClipboard } from '../controller/helpers/clipboard';
import { fullClearRowStr } from '../controller/helpers/row.helpers';
import { ISearchSettings } from '../components/views/search/component';

import EventsSessionService from './standalone/service.events.session';
import ServiceElectronIpc, { IPC } from './service.electron.ipc';
import SourcesService from './service.sources';
import HotkeysService from './service.hotkeys';
import PluginsService from './service.plugins';
import PopupsService from './standalone/service.popups';
import OutputRedirectionsService from './standalone/service.output.redirections';
import LayoutStateService from './standalone/service.layout.state';
import SettingsService from './service.settings';

import * as Toolkit from 'chipmunk.client.toolkit';

export { ITabAPI };
export { ControllerSessionTabSearch } from '../controller/session/dependencies/search/controller.session.tab.search';

export type TSessionGuid = string;
export type TSidebarTabOpener = (
    guid: string,
    session: string | undefined,
    silence: boolean,
) => Error | undefined;
export type TToolbarTabOpener = (
    guid: string,
    session: string | undefined,
    silence: boolean,
) => Promise<void>;
export type TNotificationOpener = (notification: Toolkit.INotification) => void;

export interface IServiceSubjects {
    onSessionChange: Subject<Session | undefined>;
    onSessionClosed: Subject<string>;
}

export interface ICustomTab {
    id: string;
    title: string;
    component: IComponentDesc;
}

export class TabsSessionsService implements IService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('TabsSessionsService');
    private _sessions: Map<TSessionGuid, Session | ICustomTab> = new Map();
    private _sources: Map<TSessionGuid, number> = new Map();
    private _tabsService: TabsService = new TabsService();
    private _subscriptions: { [key: string]: Subscription | SubscriptionRX } = {};
    private _currentSessionGuid: string | undefined;
    private _sessionsEventsHub: Toolkit.ControllerSessionsEvents =
        new Toolkit.ControllerSessionsEvents();
    private _sidebarTabOpener: TSidebarTabOpener | undefined;
    private _toolbarTabOpener: TToolbarTabOpener | undefined;
    private _notificationOpener: TNotificationOpener | undefined;
    private _defaultToolbarApps: Toolkit.IDefaultTabsGuids | undefined;
    private _searchSettings: { [guid: string]: ISearchSettings } = {};

    private _defaults: {
        views: IDefaultView[];
    } = {
        views: [],
    };

    constructor() {
        this.getPluginAPI = this.getPluginAPI.bind(this);
        // Delivering API getter into Plugin Service here to escape from circular dependencies
        // (which will happen if try to access to this service from Plugin Service)
        PluginsService.setPluginAPIGetter(this.getPluginAPI);
        // Listen stream events
        this._subscriptions.onStreamUpdated = ServiceElectronIpc.subscribe(
            IPC.StreamUpdated,
            this._ipc_onStreamUpdated.bind(this),
        );
        this._subscriptions.onSearchUpdated = ServiceElectronIpc.subscribe(
            IPC.SearchUpdated,
            this._ipc_onSearchUpdated.bind(this),
        );
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._subscriptions.onSessionTabChanged = this._tabsService
                .getObservable()
                .active.subscribe(this._onSessionTabSwitched.bind(this));
            this._subscriptions.onSessionTabClosed = this._tabsService
                .getObservable()
                .removed.subscribe(this._onSessionTabClosed.bind(this));
            this._subscriptions.onNewTab = HotkeysService.getObservable().newTab.subscribe(
                this._onNewTab.bind(this),
            );
            this._subscriptions.onCloseTab = HotkeysService.getObservable().closeTab.subscribe(
                this._onCloseTab.bind(this),
            );
            this._subscriptions.onNextTab = HotkeysService.getObservable().nextTab.subscribe(
                this._onNextTab.bind(this),
            );
            this._subscriptions.onPrevTab = HotkeysService.getObservable().prevTab.subscribe(
                this._onPrevTab.bind(this),
            );
            this._subscriptions.onCtrlC = HotkeysService.getObservable().ctrlC.subscribe(
                this._onCtrlC.bind(this),
            );
            this._subscriptions.RenderSessionAddRequest = ServiceElectronIpc.subscribe(
                IPC.RenderSessionAddRequest,
                this._ipc_RenderSessionAddRequest.bind(this),
            );
            const current =
                this._currentSessionGuid === undefined
                    ? undefined
                    : this._sessions.get(this._currentSessionGuid);
            OutputRedirectionsService.init(current instanceof Session ? current : undefined);
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

    public setToolbarTabOpener(opener: TToolbarTabOpener, defaults: Toolkit.IDefaultTabsGuids) {
        this._defaultToolbarApps = defaults;
        this._toolbarTabOpener = opener;
    }

    public setNotificationOpener(opener: TNotificationOpener) {
        this._notificationOpener = opener;
    }

    public setDefaultViews(views: IDefaultView[]) {
        this._defaults.views = views;
    }

    public isTabExist(guid: string): boolean {
        return this._sessions.has(guid);
    }

    public add(custom?: ICustomTab): Promise<Session | ICustomTab> {
        return new Promise((resolve, reject) => {
            let guid: string = custom !== undefined ? custom.id : Toolkit.guid();
            if (this._sessions.has(guid)) {
                return reject(new Error(`Tab guid "${guid}" already exist`));
            }
            if (custom === undefined) {
                ServiceElectronIpc.request<IPC.StreamAddResponse>(
                    new IPC.StreamAddRequest({
                        guid: guid,
                    }),
                    IPC.StreamAddResponse,
                )
                    .then((response) => {
                        if (response.error) {
                            return reject(
                                new Error(`Fail to init stream due error: ${response.error}`),
                            );
                        }
                        guid = response.guid;
                        this._logger.env(`Stream "${guid}" is inited`);
                        const session = new Session({
                            guid: guid,
                            api: this.getPluginAPI(undefined),
                            sessionsEventsHub: this._sessionsEventsHub,
                        });
                        session
                            .init()
                            .then(() => {
                                const tabAPI: ITabAPI | undefined = this._tabsService.add({
                                    guid: guid,
                                    name: 'New',
                                    active: true,
                                    content: {
                                        factory: this._defaults.views[0].component,
                                        inputs: {
                                            session: session,
                                            getTabAPI: (): ITabAPI | undefined => {
                                                return tabAPI;
                                            },
                                        },
                                    },
                                });
                                this._subscriptions[`onSourceChanged:${guid}`] = session
                                    .getObservable()
                                    .onSourceChanged.subscribe(
                                        this._onSourceChanged.bind(this, guid),
                                    );
                                this._sessions.set(guid, session);
                                session.setTabAPI(tabAPI);
                                this._sessionsEventsHub.emit().onSessionOpen(guid);
                                this.setActive(guid);
                                resolve(session);
                            })
                            .catch((err: Error) => {
                                reject(
                                    new Error(
                                        this._logger.error(
                                            `Fail to init session due error: ${err.message}`,
                                        ),
                                    ),
                                );
                            });
                    })
                    .catch((error: Error) => {
                        reject(error);
                    });
            } else {
                let tabAPI: ITabAPI | undefined;
                custom.component.inputs.getTabAPI = (): ITabAPI | undefined => {
                    return tabAPI;
                };
                this._sessions.set(guid, custom);
                tabAPI = this._tabsService.add({
                    guid: guid,
                    name: custom.title,
                    active: true,
                    content: custom.component,
                });
                this.setActive(guid);
                resolve(custom);
            }
        });
    }

    public getTabsService(): TabsService {
        return this._tabsService;
    }

    public getSessionController(session?: string): Session | Error {
        if (session === undefined) {
            session = this._currentSessionGuid;
        }
        if (session === undefined) {
            return new Error(`No session guid is provided`);
        }
        const controller: Session | ICustomTab | undefined = this._sessions.get(session);
        if (!(controller instanceof Session)) {
            return new Error(`Fail to find defiend session "${session}"`);
        }
        return controller;
    }

    public setActive(guid: string) {
        if (guid === this._currentSessionGuid) {
            return;
        }
        const session: Session | ICustomTab | undefined = this._sessions.get(guid);
        if (session === undefined) {
            this._logger.warn(`Cannot fild session ${guid}. Cannot make this session active.`);
            return;
        }
        this._currentSessionGuid = guid;
        if (session instanceof Session) {
            LayoutStateService.unlock();
            session.setActive();
            ServiceElectronIpc.send(new IPC.StreamSetActive({ guid: this._currentSessionGuid }))
                .then(() => {
                    EventsSessionService.getSubject().onSessionChange.next(session);
                    this._sessionsEventsHub.emit().onSessionChange(guid);
                })
                .catch((error: Error) => {
                    this._logger.warn(
                        `Fail to send notification about active session due error: ${error.message}`,
                    );
                });
        } else {
            LayoutStateService.lock();
            ServiceElectronIpc.send(new IPC.StreamSetActive({ guid: this._currentSessionGuid }))
                .then(() => {
                    EventsSessionService.getSubject().onSessionChange.next(undefined);
                    this._sessionsEventsHub.emit().onSessionChange(undefined);
                })
                .catch((error: Error) => {
                    this._logger.warn(
                        `Fail to send notification about active session due error: ${error.message}`,
                    );
                });
        }
        this._tabsService.setActive(this._currentSessionGuid);
    }

    public getActive(): Session | undefined {
        const controller: Session | ICustomTab | undefined =
            this._currentSessionGuid === undefined
                ? undefined
                : this._sessions.get(this._currentSessionGuid);
        return !(controller instanceof Session) ? undefined : controller;
    }

    public getEmpty(): Session | undefined {
        let target: Session | ICustomTab | undefined =
            this._currentSessionGuid === undefined
                ? undefined
                : this._sessions.get(this._currentSessionGuid);
        if (target instanceof Session) {
            return target;
        }
        target = undefined;
        this._sessions.forEach((controller: Session | ICustomTab) => {
            if (
                controller instanceof Session &&
                controller.getStreamOutput().getRowsCount() === 0
            ) {
                target = controller;
            }
        });
        return target;
    }

    public getSessionEventsHub(): Toolkit.ControllerSessionsEvents {
        return this._sessionsEventsHub;
    }

    public bars(): {
        openSidebarApp: (appId: string, openTabOnly: boolean) => void;
        openToolbarApp: (appId: string, openTabOnly: boolean) => Promise<void>;
        getDefsToolbarApps: () => Toolkit.IDefaultTabsGuids | undefined;
    } {
        const self = this;
        return {
            openSidebarApp: (appId: string, openTabOnly: boolean = false) => {
                const tab = self._tabsService.getActiveTab();
                if (self._sidebarTabOpener === undefined || tab === undefined) {
                    return;
                }
                LayoutStateService.sidebarMax();
                self._sidebarTabOpener(appId, tab.guid, openTabOnly);
            },
            openToolbarApp: (appId: string, openTabOnly: boolean = false): Promise<void> => {
                const tab = self._tabsService.getActiveTab();
                return new Promise((resolve, reject) => {
                    if (self._toolbarTabOpener === undefined || tab === undefined) {
                        this._logger.error(
                            `Cannot open Toolbar because ${
                                this._toolbarTabOpener === undefined
                                    ? `opener isn't inited`
                                    : `no active session`
                            }`,
                        );
                        return resolve();
                        //return reject(new Error(`Toolbar API isn't inited or no active tab`));
                    }
                    LayoutStateService.toolbarMax();
                    self._toolbarTabOpener(appId, tab.guid, openTabOnly)
                        .then(resolve)
                        .catch(reject);
                });
            },
            getDefsToolbarApps: (): Toolkit.IDefaultTabsGuids | undefined => {
                return self._defaultToolbarApps;
            },
        };
    }

    public getPluginAPI(pluginId: number | undefined): IAPI {
        const self = this;
        return {
            getIPC:
                pluginId === undefined
                    ? () => undefined
                    : () => {
                          const plugin = PluginsService.getPluginById(pluginId);
                          if (plugin === undefined) {
                              return undefined;
                          }
                          return plugin.ipc;
                      },
            getSettingsAPI: () => {
                return SettingsService.getPluginsAPI();
            },
            getActiveSessionId: () => {
                const controller: Session | undefined = self.getActive();
                return controller === undefined ? undefined : controller.getGuid();
            },
            addOutputInjection: (
                injection: Toolkit.IComponentInjection,
                type: Toolkit.EViewsTypes,
            ) => {
                const controller: Session | undefined = self.getActive();
                return controller === undefined
                    ? undefined
                    : controller.addOutputInjection(injection, type);
            },
            removeOutputInjection: (id: string, type: Toolkit.EViewsTypes) => {
                const controller: Session | undefined = self.getActive();
                return controller === undefined
                    ? undefined
                    : controller.removeOutputInjection(id, type);
            },
            getViewportEventsHub: () => {
                const controller: Session | undefined = self.getActive();
                return controller === undefined ? undefined : controller.getViewportEventsHub();
            },
            getSessionsEventsHub: () => {
                return self._sessionsEventsHub;
            },
            addPopup: (popup: IPopup) => {
                return PopupsService.add(popup);
            },
            removePopup: (guid: string) => {
                PopupsService.remove(guid);
            },
            setSidebarTitleInjection: (component: IComponentDesc | undefined) => {
                EventsSessionService.getSubject().onSidebarTitleInjection.next(component);
            },
            openSidebarApp: self.bars().openSidebarApp,
            openToolbarApp: self.bars().openToolbarApp,
            getDefaultToolbarAppsIds: (): Toolkit.IDefaultTabsGuids => {
                return Object.assign({}, self._defaultToolbarApps);
            },
            addNotification: (notification: Toolkit.INotification) => {
                if (self._notificationOpener === undefined) {
                    return;
                }
                self._notificationOpener(notification);
            },
        };
    }

    public setSearchSettings(guid: string, settings: ISearchSettings) {
        this._searchSettings[guid] = settings;
    }

    public getSearchSettings(guid: string): ISearchSettings | undefined {
        return this._searchSettings[guid];
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
        if (tab.guid === undefined) {
            return;
        }
        if (!this._sessions.has(tab.guid)) {
            // Session isn't created yet, but creating
            return;
        }
        this.setActive(tab.guid);
        if (this.getSearchSettings(tab.guid) === undefined) {
            this.setSearchSettings(tab.guid, {
                casesensitive: false,
                wholeword: false,
                regexp: true,
            });
        }
    }

    private _onSessionTabClosed(session: string) {
        // Get session controller
        const controller: Session | ICustomTab | undefined = this._sessions.get(session);
        if (controller === undefined) {
            this._logger.warn(
                `Fail to destroy session "${session}" because cannot find this session.`,
            );
            return;
        }
        this._sessions.delete(session);
        if (controller instanceof Session) {
            controller
                .destroy()
                .then(() => {
                    this._removeSession(session);
                    this._logger.env(`Session "${session}" is destroyed`);
                })
                .catch((error: Error) => {
                    this._removeSession(session);
                    this._logger.warn(
                        `Fail to destroy session "${session}" due error: ${error.message}`,
                    );
                });
        } else {
            this._removeSession(session);
            this._logger.env(`Session "${session}" is removed`);
        }
        this._removeSearchSettings(session);
    }

    private _removeSearchSettings(guid: string) {
        delete this._searchSettings[guid];
    }

    private _removeSession(guid: string) {
        if (this._subscriptions[`onSourceChanged:${guid}`] !== undefined) {
            this._subscriptions[`onSourceChanged:${guid}`].unsubscribe();
        }
        if (this._sessions.size === 0) {
            EventsSessionService.getSubject().onSessionChange.next(undefined);
            this._sessionsEventsHub.emit().onSessionChange(undefined);
        }
        EventsSessionService.getSubject().onSessionClosed.next(guid);
        this._sessionsEventsHub.emit().onSessionClose(guid);
    }

    private _onNewTab() {
        this.add();
    }

    private _onCloseTab() {
        this._currentSessionGuid !== undefined &&
            this._tabsService.remove(this._currentSessionGuid);
    }

    private _onNextTab() {
        this._tabsService.next();
    }

    private _onPrevTab() {
        this._tabsService.prev();
    }

    private _onCtrlC() {
        const window_selection = window.getSelection();
        if (window_selection === null) {
            return;
        }
        if (window_selection.toString() !== '') {
            return;
        }
        const session = this.getActive();
        if (session === undefined) {
            return;
        }
        OutputRedirectionsService.getOutputSelectionRanges(session.getGuid())
            .then((selection) => {
                return session
                    .getSessionStream()
                    .getRowsSelection(selection)
                    .then((rows) => {
                        copyTextToClipboard(fullClearRowStr(rows.map((row) => row.str).join('\n')));
                    })
                    .catch((err: Error) => {
                        this._logger.warn(
                            `Fail get text selection for range ${selection.join('; ')} due error: ${
                                err.message
                            }`,
                        );
                    });
            })
            .catch((err: Error) => {
                this._logger.warn(
                    `Fail to call OutputRedirectionsService.getOutputSelectionRanges due error: ${err.message}`,
                );
            });
    }

    private _ipc_RenderSessionAddRequest(
        message: IPC.RenderSessionAddRequest,
        response: (message: IPC.TMessage) => void,
    ) {
        this.add()
            .then((session: Session | ICustomTab) => {
                if (session instanceof Session) {
                    response(new IPC.RenderSessionAddResponse({ session: session.getGuid() }));
                } else {
                    response(
                        new IPC.RenderSessionAddResponse({
                            session: '',
                            error: `Fail to create Session. Has been gotten ICustomTab`,
                        }),
                    );
                }
            })
            .catch((error: Error) => {
                response(new IPC.RenderSessionAddResponse({ session: '', error: error.message }));
            });
    }

    private _ipc_onStreamUpdated(message: IPC.StreamUpdated) {
        this._sessionsEventsHub
            .emit()
            .onStreamUpdated({ session: message.guid, rows: message.rowsCount });
    }

    private _ipc_onSearchUpdated(message: IPC.SearchUpdated) {
        this._sessionsEventsHub
            .emit()
            .onSearchUpdated({ session: message.guid, rows: message.rowsCount });
    }
}

export default new TabsSessionsService();
