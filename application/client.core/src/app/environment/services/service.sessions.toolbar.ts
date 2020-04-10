import { TabsService, IComponentDesc } from 'chipmunk-client-material';
import { Subscription } from 'rxjs';
import { IService } from '../interfaces/interface.service';
import { DefaultViews, CDefaultTabsGuids, IDefaultTabsGuids } from '../states/state.default.toolbar.apps';
import { ControllerSessionTab } from '../controller/controller.session.tab';

import EventsSessionService from './standalone/service.events.session';
import PluginsService, { IPluginData } from './service.plugins';
import ControllerPluginIPC from '../controller/controller.plugin.ipc';
import TabsSessionsService from './service.sessions.tabs';
import HotkeysService from './service.hotkeys';
import LayoutStateService from './standalone/service.layout.state';

import * as Toolkit from 'chipmunk.client.toolkit';

export { CDefaultTabsGuids, IDefaultTabsGuids };

export interface ISidebarPluginInfo {
    id: number;
    name: string;
    displayName: string;
    factory: any;
    ipc: ControllerPluginIPC;
}

export class ToolbarSessionsService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('ToolbarSessionsService');
    private _plugins: ISidebarPluginInfo[] = [];
    private _guid: string = Toolkit.guid();
    private _tabsService: TabsService = new TabsService();
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _inputs: { [key: string]: any } = {};

    constructor() {
        this.setCommonInputs({});
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscriptions.onFocusSearchInput = HotkeysService.getObservable().focusSearchInput.subscribe(this._onFocusSearchInput.bind(this));
            this._subscriptions.onSessionClosed = EventsSessionService.getObservable().onSessionClosed.subscribe(this._onSessionClosed.bind(this));
            this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
            TabsSessionsService.setSidebarTabOpener(this.setActive.bind(this));
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

    public create(): void {
        // Add default views
        this._addDefaultTabs();
        // Add views of plugins
        this._plugins = this._getSidebarPlugins();
        this._plugins.forEach((pluginInfo: ISidebarPluginInfo, i: number) => {
            const guid: string = Toolkit.guid();
            const inputs = Object.assign({
                api: TabsSessionsService.getPluginAPI(pluginInfo.id),
                session: this._guid
            }, this._inputs);
            this._tabsService.add({
                guid: guid,
                name: pluginInfo.displayName,
                active: false,
                content: {
                    factory: pluginInfo.factory,
                    inputs: inputs,
                    resolved: true
                }
            });
        });
    }

    public getTabsService(): TabsService {
        return this._tabsService;
    }

    public setCommonInputs(inputs: { [key: string]: any }) {
        this._inputs = Object.assign({
            setActiveTab: this.setActive.bind(this),
            getDefaultsTabGuids: this.getDefaultsGuids.bind(this),
        }, inputs);
    }

    public add(name: string, content: IComponentDesc, guid?: string): string {
        guid = typeof guid !== 'string' ? Toolkit.guid() : guid;
        this._tabsService.add({
            guid: guid,
            name: name,
            active: true,
            content: content,
        });
        return guid;
    }

    public remove(guid: string): void {
        this._tabsService.remove(guid);
    }

    public has(guid: string): boolean {
        return this._tabsService.has(guid);
    }

    public setActive(guid: string) {
        this._tabsService.setActive(guid);
    }

    public getDefaultsGuids(): IDefaultTabsGuids {
        return CDefaultTabsGuids;
    }

    private _getSidebarPlugins(): ISidebarPluginInfo[] {
        const info: ISidebarPluginInfo[] = [];
        PluginsService.getAvailablePlugins().forEach((plugin: IPluginData) => {
            if (plugin.factories[Toolkit.EViewsTypes.sidebarHorizontal] === undefined) {
                return;
            }
            info.push({
                id: plugin.id,
                name: plugin.name,
                factory: plugin.factories[Toolkit.EViewsTypes.sidebarHorizontal],
                ipc: plugin.ipc,
                displayName: plugin.displayName,
            });
        });
        return info;
    }

    private _addDefaultTabs() {
        // Add default views
        DefaultViews.forEach((defaultView, i) => {
            if (this._tabsService.has(defaultView.guid)) {
                return;
            }
           this._tabsService.unshift({
                guid: defaultView.guid,
                name: defaultView.name,
                active: i === DefaultViews.length - 1,
                tabCaptionInjection: defaultView.tabCaptionInjection === undefined ? undefined : {
                    factory: defaultView.tabCaptionInjection,
                    inputs: Object.assign(defaultView.inputs, this._inputs),
                    resolved: false
                },
                closable: false,
                content: {
                    factory: defaultView.factory,
                    inputs: Object.assign(defaultView.inputs, this._inputs),
                    resolved: false
                }
            });
        });
    }

    private _removeDefaultTabs() {
        // Add default views
        DefaultViews.forEach((defaultView, i) => {
            if (!this._tabsService.has(defaultView.guid)) {
                return;
            }
            this._tabsService.remove(defaultView.guid);
        });
    }

    private _onFocusSearchInput() {
        LayoutStateService.toolbarMax();
        this._tabsService.setActive(CDefaultTabsGuids.search);
    }

    private _onSessionClosed(session: string) {
        if (TabsSessionsService.getActive() !== undefined) {
            return;
        }
        // No any active sessions
        this._removeDefaultTabs();
    }

    private _onSessionChange(session: ControllerSessionTab | undefined) {
        if (session === undefined) {
            // No any active sessions
            return;
        }
        this._addDefaultTabs();
    }

}

export default (new ToolbarSessionsService());
