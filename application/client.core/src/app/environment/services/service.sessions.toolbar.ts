import { TabsService, IComponentDesc, ITab } from 'chipmunk-client-material';
import { Subscription, Subject, Observable } from 'rxjs';
import { IService } from '../interfaces/interface.service';
import { DefaultViews, CDefaultTabsGuids } from '../states/state.default.toolbar.apps';
import { ControllerSessionTab } from '../controller/controller.session.tab';

import EventsSessionService from './standalone/service.events.session';
import PluginsService, { IPluginData } from './service.plugins';
import ControllerPluginIPC from '../controller/controller.plugin.ipc';
import TabsSessionsService from './service.sessions.tabs';
import HotkeysService from './service.hotkeys';
import LayoutStateService from './standalone/service.layout.state';

import * as Toolkit from 'chipmunk.client.toolkit';

export { CDefaultTabsGuids };

export interface ISidebarPluginInfo {
    id: number;
    name: string;
    displayName: string;
    factory: any;
    ipc: ControllerPluginIPC;
}

export interface IChangeEvent {
    session: string;
    service: TabsService;
}

export interface ITabInfo {
    name: string;
    id: string;
}

export class ToolbarSessionsService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('ToolbarSessionsService');
    private _plugins: ISidebarPluginInfo[] = [];
    private _guid: string = Toolkit.guid();
    private _active: string | undefined;
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _inputs: { [key: string]: any } = {};
    private _sessions: Map<string, TabsService> = new Map();
    private _subjects: {
        change: Subject<IChangeEvent | undefined>,
        update: Subject<IChangeEvent | undefined>,
    } = {
        change: new Subject<IChangeEvent | undefined>(),
        update: new Subject<IChangeEvent | undefined>(),
    };
    private _tabs: ITab[] = [];

    constructor() {
        this.setCommonInputs({});
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscriptions.onFocusSearchInput = HotkeysService.getObservable().focusSearchInput.subscribe(this._onFocusSearchInputHotkey.bind(this));
            this._subscriptions.onSessionClosed = EventsSessionService.getObservable().onSessionClosed.subscribe(this._onSessionClosed.bind(this));
            this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
            TabsSessionsService.setToolbarTabOpener(this.setActive.bind(this), CDefaultTabsGuids);
            resolve();
        });
    }

    public getName(): string {
        return 'ToolbarSessionsService';
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public getObservable(): {
        change: Observable<IChangeEvent | undefined>,
        update: Observable<IChangeEvent | undefined>,
    } {
        return {
            change: this._subjects.change.asObservable(),
            update: this._subjects.update.asObservable(),
        };
    }

    public getTabsService(): TabsService | undefined {
        return this._sessions.get(this._active);
    }

    public setCommonInputs(inputs: { [key: string]: any }) {
        this._inputs = Object.assign({
            setActiveTab: this.setActive.bind(this),
            getDefaultsTabGuids: this.getDefaultsGuids.bind(this),
        }, inputs);
    }

    public add(name: string, content: IComponentDesc, guid?: string): string | undefined {
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined) {
            return undefined;
        }
        guid = typeof guid !== 'string' ? Toolkit.guid() : guid;
        service.add({
            guid: guid,
            name: name,
            active: true,
            content: content,
        });
        this._sessions.set(this._active, service);
        this._subjects.update.next({
            session: this._active,
            service: service,
        });
        return guid;
    }

    public addByGuid(guid: string): void {
        const tab: ITab | undefined = this._getTabByGuid(guid);
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined || tab === undefined) {
            return undefined;
        }
        service.add(tab);
        this._sessions.set(this._active, service);
        this._subjects.update.next({
            session: this._active,
            service: service,
        });
    }

    public remove(guid: string): void {
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined) {
            return undefined;
        }
        service.remove(guid);
        this._sessions.set(this._active, service);
        this._subjects.update.next({
            session: this._active,
            service: service,
        });
    }

    public has(guid: string): boolean {
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined) {
            return false;
        }
        return service.has(guid);
    }

    public setActive(guid: string) {
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined) {
            return false;
        }
        if (!service.has(guid)) {
            const tab: ITab | undefined = this._getTabByGuid(guid);
            if (tab === undefined) {
                return undefined;
            }
            service.add(tab);
        }
        service.setActive(guid);
    }

    public getDefaultsGuids(): Toolkit.IDefaultTabsGuids {
        return CDefaultTabsGuids;
    }

    public getInactiveTabs(session?: string): ITab[] | undefined {
        session = session === undefined ? this._active : session;
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined) {
            return undefined;
        }
        return this._getAvailableTabs().filter((tab: ITab) => {
            return !service.has(tab.guid);
        });

    }

    private _onFocusSearchInputHotkey() {
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined) {
            return;
        }
        LayoutStateService.toolbarMax();
        service.setActive(CDefaultTabsGuids.search);
    }

    private _onSessionClosed(session: string) {
        const service: TabsService | undefined = this._sessions.get(session);
        if (service === undefined) {
            return;
        }
        service.destroy();
        this._sessions.delete(session);
        if (this._active === session) {
            this._active = undefined;
            this._subjects.change.next(undefined);
        }
    }

    private _onSessionChange(controller: ControllerSessionTab | undefined) {
        if (controller === undefined) {
            // No any active sessions
            return;
        }
        let service: TabsService | undefined = this._sessions.get(controller.getGuid());
        if (service === undefined) {
            service = new TabsService({ guid: `toolbar: ${controller.getGuid()}` });
            this._getAvailableTabs().map((tab: ITab) => {
                if (!this._isTabVisibleByDefault(tab.guid)) {
                    return;
                }
                service.unshift(tab);
            });
            this._sessions.set(controller.getGuid(), service);
        }
        this._active = controller.getGuid();
        this._subjects.change.next({
            session: this._active,
            service: service,
        });
    }

    private _getAvailableTabs(): ITab[] {
        const tabs: ITab[] = [];
        // Add default tabs
        DefaultViews.forEach((defaultView, i) => {
            tabs.push({
                guid: defaultView.guid,
                name: defaultView.name,
                active: i === DefaultViews.length - 1,
                tabCaptionInjection: defaultView.tabCaptionInjection === undefined ? undefined : {
                    factory: defaultView.tabCaptionInjection,
                    inputs: Object.assign(defaultView.inputs, this._inputs),
                    resolved: false
                },
                closable: defaultView.closable,
                content: {
                    factory: defaultView.factory,
                    inputs: Object.assign(defaultView.inputs, this._inputs),
                    resolved: false
                }
            });
        });
        // Add plugin's tabs
        PluginsService.getAvailablePlugins().forEach((plugin: IPluginData) => {
            if (plugin.factories[Toolkit.EViewsTypes.sidebarHorizontal] === undefined) {
                return;
            }
            const guid: string = Toolkit.guid();
            const inputs = Object.assign({
                api: TabsSessionsService.getPluginAPI(plugin.id),
                session: this._guid
            }, this._inputs);
            tabs.push({
                guid: guid,
                name: plugin.displayName,
                active: false,
                content: {
                    factory: plugin.factories[Toolkit.EViewsTypes.sidebarHorizontal],
                    inputs: inputs,
                    resolved: true
                }
            });
        });
        return tabs;
    }

    private _isTabVisibleByDefault(guid: string): boolean {
        let result: boolean = false;
        DefaultViews.forEach((defaultView, i) => {
            if (result) {
                return;
            }
            if (defaultView.default === true && defaultView.guid === guid) {
                result = true;
            }
        });
        return result;
    }

    private _getTabByGuid(guid: string): ITab | undefined {
        if (typeof guid !== 'string' || guid.trim() === '') {
            return undefined;
        }
        return this._getAvailableTabs().find((tab: ITab) => {
            return tab.guid === guid;
        });
    }
}

export default (new ToolbarSessionsService());
