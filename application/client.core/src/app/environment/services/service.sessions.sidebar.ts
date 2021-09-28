import { TabsService, IComponentDesc, ITab } from 'chipmunk-client-material';
import { Subscription, Subject, Observable } from 'rxjs';
import { IService } from '../interfaces/interface.service';
import { Session } from '../controller/session/session';
import { IPluginData } from '../services/service.plugins';
import { getSharedServices } from './shared.services.sidebar';
import {
    DefaultSidebarApps,
    IDefaultSidebarApp,
    CGuids,
} from '../states/state.default.sidebar.apps';
import { IPC } from '../services/service.electron.ipc';

import EventsSessionService from './standalone/service.events.session';
import TabsSessionsService from './service.sessions.tabs';
import ControllerPluginIPC from '../controller/controller.plugin.ipc';
import PluginsService from '../services/service.plugins';
import ElectronIpcService from '../services/service.electron.ipc';
import LayoutStateService from '../services/standalone/service.layout.state';

import * as Toolkit from 'chipmunk.client.toolkit';

export { ITab };

export interface ISidebarPluginInfo {
    id: number;
    name: string;
    factory: any;
    ipc: ControllerPluginIPC;
}

export class SidebarSessionsService implements IService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarSessionsService');
    private _services: Map<string, TabsService> = new Map();
    private _servicesSubs: Map<string, { [key: string]: Subscription }> = new Map();
    private _tabs: Map<string, Map<string, ITab>> = new Map();
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _inputs: { [key: string]: any } = {};
    private _injected: IComponentDesc | undefined;
    private _droppedInjected: string = '';
    private _subjects: {
        injection: Subject<IComponentDesc | undefined>;
    } = {
        injection: new Subject<IComponentDesc | undefined>(),
    };

    constructor() {}

    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._subscriptions.onSessionChange =
                EventsSessionService.getObservable().onSessionChange.subscribe(
                    this._onSessionChange.bind(this),
                );
            this._subscriptions.onSessionClosed =
                EventsSessionService.getObservable().onSessionClosed.subscribe(
                    this._onSessionClosed.bind(this),
                );
            this._subscriptions.onSidebarTitleInjection =
                EventsSessionService.getObservable().onSidebarTitleInjection.subscribe(
                    this._onSidebarTitleInjection.bind(this),
                );
            this._subscriptions.ViewSwitchEvent = ElectronIpcService.subscribe(
                IPC.ViewSwitchEvent,
                this._ipc_ViewSwitchEvent.bind(this),
            );
            TabsSessionsService.setSidebarTabOpener(this.open.bind(this));
            resolve();
        });
    }

    public getName(): string {
        return 'SidebarSessionsService';
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._services.forEach((serivce: TabsService) => {
            serivce.clear();
        });
        this._services.clear();
    }

    public getTabsService(session: string): TabsService | undefined {
        return this._services.get(session);
    }

    public setCommonInputs(inputs: { [key: string]: any }) {
        this._inputs = inputs;
    }

    public add(tabs: ITab[] | ITab, session?: string) {
        const verified_session = this._verifySessionGuid(session);
        if (verified_session === undefined) {
            return;
        }
        tabs = tabs instanceof Array ? tabs : [tabs];
        // Add tabs
        tabs.forEach((tab: ITab) => {
            this._add(tab, verified_session);
        });
    }

    public addByGuid(guid: string, session?: string) {
        const verified_session = this._verifySessionGuid(session);
        if (verified_session === undefined) {
            return;
        }
        const tabs: Map<string, ITab> | Error = this._getSessionAvailableTabs(verified_session);
        if (tabs instanceof Error) {
            return;
        }
        const tab = tabs.get(guid);
        if (tab === undefined) {
            this._logger.warn(
                `Fail to find a tab "${guid}". Tab isn't available in session: ${verified_session}`,
            );
            return;
        }
        this._add(tab, verified_session, true);
    }

    public remove(tab: string, session?: string): Error | undefined {
        const service: TabsService | Error = this._getSessionTabsService(session);
        if (service instanceof Error) {
            return service;
        }
        service.remove(tab);
        return undefined;
    }

    public has(tab: string, session?: string): boolean {
        const verified_session = this._verifySessionGuid(session);
        if (verified_session === undefined) {
            return false;
        }
        const service: TabsService | undefined = this._services.get(verified_session);
        if (service === undefined) {
            return false;
        }
        return service.has(tab);
    }

    public setActive(tab: string, session?: string): Error | undefined {
        const service: TabsService | Error = this._getSessionTabsService(session);
        if (service instanceof Error) {
            return service;
        }
        service.setActive(tab);
        return undefined;
    }

    /**
     * Add and open sidebar tab
     * @param guid {string} - unique sidebar GUID
     * @param session {string} - target session
     * @param openTabOnly {bool} - true - tab would be added (if doesn't exist), but not active;
     *                             false - tab would be added (if doesn't exist) and set active.
     */
    public open(
        guid: string,
        session: string | undefined,
        openTabOnly: boolean = false,
    ): Error | undefined {
        const service: TabsService | Error = this._getSessionTabsService(session);
        if (service instanceof Error) {
            return service;
        }
        const active_tab = service.getActiveTab();
        const current: string | undefined = active_tab === undefined ? undefined : active_tab.guid;
        if (!service.has(guid)) {
            const available: ITab[] | undefined = this.getAvailableTabs();
            if (available === undefined) {
                return new Error(`No available tabs found`);
            }
            available.forEach((tab: ITab) => {
                if (service.has(guid)) {
                    return;
                }
                if (tab.guid === guid) {
                    this.add(tab, session);
                }
            });
        }
        if (service.has(guid)) {
            if (openTabOnly === false) {
                this.setActive(guid);
            } else if (current !== undefined) {
                this.setActive(current);
            }
        }
        return service.has(guid)
            ? undefined
            : new Error(`Tab ${guid} wasn't found in a list of available tabs.`);
    }

    public getAvailableTabs(session?: string): ITab[] | undefined {
        const verified_session = this._verifySessionGuid(session);
        if (verified_session === undefined) {
            return undefined;
        }
        const tabs: Map<string, ITab> | undefined = this._tabs.get(verified_session);
        const service: TabsService | undefined = this._services.get(verified_session);
        if (tabs === undefined || service === undefined) {
            return undefined;
        }
        const available: ITab[] = [];
        tabs.forEach((tab: ITab) => {
            if (tab.guid === undefined || service.has(tab.guid)) {
                return;
            }
            available.push(tab);
        });
        return available;
    }

    public getObservable(): {
        injection: Observable<IComponentDesc | undefined>;
    } {
        return {
            injection: this._subjects.injection.asObservable(),
        };
    }

    public setTitleInjection(comp: IComponentDesc | undefined) {
        if (comp === undefined && this._injected === undefined) {
            return;
        }
        if (
            comp !== undefined &&
            this._injected !== undefined &&
            comp.factory !== undefined &&
            this._injected.factory !== undefined
        ) {
            if (
                typeof comp.factory.name === 'string' &&
                typeof this._injected.factory.name === 'string'
            ) {
                if (
                    comp.factory.name === this._injected.factory.name &&
                    Object.keys(comp.inputs).length === Object.keys(this._injected.inputs).length
                ) {
                    return;
                }
            }
        }
        // Check before plugins factories
        if (
            comp !== undefined &&
            comp.factory !== undefined &&
            typeof comp.factory.name === 'string'
        ) {
            // If it's plugin, we should have stored factory of component (it was created in stored in PluginsService
            // during intialization of plugin). If it is - we should put instead component reference, reference to factory
            // and set it is "resolved"
            const factory = PluginsService.getStoredFactoryByName(comp.factory.name);
            if (factory !== undefined) {
                comp.factory = factory;
                comp.resolved = true;
            }
        }
        this._injected = comp;
        this._subjects.injection.next(comp);
    }

    private _create(session: string) {
        // Reset injected title content
        this.setTitleInjection(undefined);
        if (this._services.has(session)) {
            // Service already exists
            return;
        }
        // Add all possible tabs
        const tabs: Map<string, ITab> = new Map();
        // Create new tabs service
        const service: TabsService = new TabsService();
        // Subscriptions storage
        const subscriptions: { [key: string]: Subscription } = {};
        // Subscribe on service events
        subscriptions.active = service
            .getObservable()
            .active.subscribe(this._dropTitleInjectedContent.bind(this, session));
        // Store service
        this._services.set(session, service);
        // Store subscriptions
        this._servicesSubs.set(session, subscriptions);
        // Add default sidebar apps
        DefaultSidebarApps.forEach((description: IDefaultSidebarApp, index) => {
            const tab: ITab = Object.assign({}, description.tab);
            if (tab.guid === undefined) {
                this._logger.error(
                    `Fail to add new tab (${JSON.stringify(
                        description.tab,
                    )}) because it doesn't have guid {string}`,
                );
                return;
            }
            // Add to storage
            tabs.set(tab.guid, tab);
            if (description.addedAsDefault) {
                // Add tab to sidebar
                this._add(tab, session, index === 0);
            }
        });
        // Detect tabs related to transports (plugins)
        PluginsService.getAvailablePlugins().forEach((plugin: IPluginData) => {
            if (plugin.factories[Toolkit.EViewsTypes.sidebarVertical] === undefined) {
                return;
            }
            // Add to storage
            tabs.set(plugin.name, {
                guid: plugin.name,
                name: plugin.displayName,
                active: false,
                content: {
                    factory: plugin.factories[Toolkit.EViewsTypes.sidebarVertical],
                    resolved: true,
                    inputs: {
                        session: session,
                        api: TabsSessionsService.getPluginAPI(plugin.id),
                        sessions: plugin.controllers.sessions,
                    },
                },
            });
        });
        this._tabs.set(session, tabs);
    }

    private _add(tab: ITab, session: string, active: boolean = false): Error | string {
        if (typeof tab !== 'object' || tab === null) {
            return new Error(`Tab object isn't defined`);
        }
        // Get storage of service
        const service: TabsService | Error = this._getSessionTabsService(session);
        if (service instanceof Error) {
            return service;
        }
        if (tab.guid !== undefined && service.has(tab.guid)) {
            this.setActive(tab.guid, session);
            return tab.guid;
        }
        // Get verified session guid
        const verified_session = this._verifySessionGuid(session);
        if (verified_session === undefined) {
            return new Error(`Fail to get session guid`);
        }
        // Add guid of tab if isn't defiend
        if (tab.guid === undefined) {
            tab.guid = Toolkit.guid();
        }
        if (tab.content === undefined) {
            return new Error(`Tab doesn't have valid content property`);
        }
        // Add default inputs
        tab.content.inputs = this._addDefaultsInputs(tab.content.inputs, session, tab.guid);
        // Add tab
        service.add(tab);
        // Save service
        this._services.set(verified_session, service);
        // Set active if it's requested
        if (active) {
            this.setActive(tab.guid, verified_session);
        }
        return tab.guid;
    }

    private _dropTitleInjectedContent(session: string, tab: ITab) {
        const hash: string = `${session}-${tab.guid}`;
        if (hash === this._droppedInjected) {
            return;
        }
        this.setTitleInjection(undefined);
        this._droppedInjected = hash;
    }

    private _getActiveSessionGuid(): string | undefined {
        const session = TabsSessionsService.getActive();
        return session === undefined ? undefined : session.getGuid();
    }

    private _verifySessionGuid(session?: string): string | undefined {
        return session === undefined ? this._getActiveSessionGuid() : session;
    }

    private _getSessionTabsService(session?: string): Error | TabsService {
        const verified_session = this._verifySessionGuid(session);
        if (verified_session === undefined) {
            return new Error(`Fail to get session guid`);
        }
        const service: TabsService | undefined = this._services.get(verified_session);
        if (service === undefined) {
            return new Error(
                this._logger.warn(`Fail to get tab's service for session "${session}"`),
            );
        }
        return service;
    }

    private _getSessionAvailableTabs(session?: string): Error | Map<string, ITab> {
        const verified_session = this._verifySessionGuid(session);
        if (verified_session === undefined) {
            return new Error(`Fail to get session guid`);
        }
        const tabs: Map<string, ITab> | undefined = this._tabs.get(verified_session);
        if (tabs === undefined) {
            return new Error(
                this._logger.warn(`Fail to get available tabs for session "${session}"`),
            );
        }
        return tabs;
    }

    private _onSessionChange(controller: Session | undefined) {
        if (controller === undefined) {
            return;
        }
        // Create
        this._create(controller.getGuid());
    }

    private _onSessionClosed(session: string) {
        const subscriptions: { [key: string]: Subscription } | undefined =
            this._servicesSubs.get(session);
        if (subscriptions !== undefined) {
            Object.keys(subscriptions).forEach((key: string) => {
                subscriptions[key].unsubscribe();
            });
        }
        this._servicesSubs.delete(session);
        const service: TabsService | undefined = this._services.get(session);
        if (service !== undefined) {
            service.destroy();
        }
        this._services.delete(session);
        this._tabs.delete(session);
        if (this._tabs.size === 0) {
            this.setTitleInjection(undefined);
        }
    }

    private _onSidebarTitleInjection(component: IComponentDesc | undefined) {
        this.setTitleInjection(component);
    }

    private _addDefaultsInputs(
        inputs: { [key: string]: any },
        session: string,
        tab: string,
    ): { [key: string]: any } {
        // Add preset inputs
        inputs = Object.assign(inputs, this._inputs);
        // Add session guid if missed
        if (inputs.session === undefined) {
            inputs.session = session;
        }
        // Add close handler
        if (inputs.close === undefined) {
            inputs.close = () => {
                this.remove(tab, session);
            };
        }
        // Add services
        if (inputs.services === undefined) {
            inputs.services = getSharedServices();
        }
        return inputs;
    }

    private _ipc_ViewSwitchEvent(event: IPC.ViewSwitchEvent) {
        const active = this._getActiveSessionGuid();
        if (active === undefined || active !== event.session) {
            return;
        }
        LayoutStateService.sidebarMax();
        switch (event.target) {
            case IPC.AvailableViews.SearchManager:
                this.open(CGuids.search, event.session);
                break;
            case IPC.AvailableViews.CommentsManager:
                this.open(CGuids.comments, event.session);
                break;
            case IPC.AvailableViews.Shell:
                this.open(CGuids.shell, event.session);
                break;
            case IPC.AvailableViews.DLTConnector:
                this.open(CGuids.dltdeamon, event.session);
                break;
            case IPC.AvailableViews.Concat:
                this.open(CGuids.concat, event.session);
                break;
            case IPC.AvailableViews.Merge:
                this.open(CGuids.merging, event.session);
                break;
        }
    }
}

export default new SidebarSessionsService();
