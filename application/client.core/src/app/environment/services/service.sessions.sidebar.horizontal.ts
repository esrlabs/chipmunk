import { TabsService, IComponentDesc } from 'logviewer-client-complex';
import { Subscription } from './service.electron.ipc';
import * as Toolkit from 'logviewer.client.toolkit';
import { IService } from '../interfaces/interface.service';
import PluginsService, { IPluginData } from './service.plugins';
import ControllerPluginIPC from '../controller/controller.plugin.ipc';
import TabsSessionsService from './service.sessions.tabs';
import { ViewSearchComponent } from '../components/views/search/component';

const DefaultViews = [
    {
        name: 'Search',
        factory: ViewSearchComponent,
        inputs: { }
    }
];

export interface ISidebarPluginInfo {
    id: number;
    name: string;
    factory: any;
    ipc: ControllerPluginIPC;
}

export class HorizontalSidebarSessionsService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('HorizontalSidebarSessionsService');
    private _plugins: ISidebarPluginInfo[] = [];
    private _guid: string = Toolkit.guid();
    private _tabsService: TabsService = new TabsService();
    private _subscriptions: { [key: string]: Subscription | undefined } = {};
    private _inputs: { [key: string]: any } = {};

    constructor() {

    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    public getName(): string {
        return 'HorizontalSidebarSessionsService';
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public create(): void {
        // Add default views
        DefaultViews.forEach((defaultView, i) => {
            const guid: string = Toolkit.guid();
            this._tabsService.add({
                guid: guid,
                name: defaultView.name,
                active: i === 0,
                closable: false,
                content: {
                    factory: defaultView.factory,
                    inputs: Object.assign(defaultView.inputs, this._inputs),
                    resolved: false
                }
            });
        });
        // Add views of plugins
        this._plugins = this._getSidebarPlugins();
        this._plugins.forEach((pluginInfo: ISidebarPluginInfo, i: number) => {
            const guid: string = Toolkit.guid();
            this._tabsService.add({
                guid: guid,
                name: pluginInfo.name,
                active: false,
                content: {
                    factory: pluginInfo.factory,
                    inputs: Object.assign({
                        api: TabsSessionsService.getPluginAPI(pluginInfo.id),
                        session: this._guid
                    }, this._inputs),
                    resolved: true
                }
            });
        });
    }

    public getTabsService(): TabsService {
        return this._tabsService;
    }

    public setCommonInputs(inputs: { [key: string]: any }) {
        this._inputs = inputs;
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

    private _getSidebarPlugins(): ISidebarPluginInfo[] {
        const plugins: string[] = ['xterminal'];
        const info: ISidebarPluginInfo[] = [];
        plugins.forEach((pluginName: string, index: number) => {
            const plugin: IPluginData | undefined = PluginsService.getPlugin(pluginName);
            if (plugin === undefined) {
                return this._logger.warn(`Plugin "${pluginName}" is defined ot be injected into SidebarHorizontal, but no such plugin found.`);
            }
            if (plugin.factories[Toolkit.EViewsTypes.sidebarHorizontal] === undefined) {
                return this._logger.warn(`Plugin "${pluginName}" is defined ot be injected into SidebarHorizontal, but target view isn't detected.`);
            }
            info.push({
                id: plugin.id,
                name: pluginName,
                factory: plugin.factories[Toolkit.EViewsTypes.sidebarHorizontal],
                ipc: plugin.ipc
            });
        });
        return info;
    }

}

export default (new HorizontalSidebarSessionsService());
