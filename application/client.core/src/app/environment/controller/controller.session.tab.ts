import PluginsService, { IPluginData } from '../services/service.plugins';
import { Subscription } from '../services/service.electron.ipc';
import { ControllerSessionTabStream } from './controller.session.tab.stream';
import { ControllerSessionTabSearch } from './controller.session.tab.search';
import { TabsService } from 'logviewer-client-complex';
import * as Toolkit from 'logviewer.client.toolkit';

export interface IControllerSession {
    guid: string;
    transports: string[];
}

export interface IComponentInjection {
    factory: any;
    inputs: { [key: string]: any };
}

export class ControllerSessionTab {

    private _logger: Toolkit.Logger;
    private _sessionId: string;
    private _transports: string[];
    private _stream: ControllerSessionTabStream;
    private _search: ControllerSessionTabSearch;
    private _sidebarTabsService: TabsService;
    private _subscriptions: { [key: string]: Subscription | undefined } = { };

    constructor(params: IControllerSession) {
        this._sessionId = params.guid;
        this._transports = params.transports;
        this._logger = new Toolkit.Logger(`ControllerSession: ${params.guid}`);
        this._stream = new ControllerSessionTabStream({
            guid: params.guid,
            transports: params.transports.slice()
        });
        this._search = new ControllerSessionTabSearch({
            guid: params.guid,
            transports: params.transports.slice()
        });
        this._sidebar_update();
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public getGuid(): string {
        return this._sessionId;
    }

    public getSessionStream(): ControllerSessionTabStream {
        return this._stream;
    }

    public getSessionSearch(): ControllerSessionTabSearch {
        return this._search;
    }

    public getSidebarTabsService(): TabsService {
        return this._sidebarTabsService;
    }

    public getOutputBottomInjections(): Map<string, IComponentInjection> {
        const injections: Map<string, IComponentInjection> = new Map();
        this._transports.forEach((pluginName: string) => {
            const plugin: IPluginData | undefined = PluginsService.getPlugin(pluginName);
            if (plugin === undefined) {
                this._logger.warn(`Plugin "${pluginName}" is defined as transport, but doesn't exist in storage.`);
                return;
            }
            if (plugin.factories[Toolkit.EViewsTypes.outputBottom] === undefined) {
                return;
            }
            injections.set(plugin.name, {
                factory: plugin.factories[Toolkit.EViewsTypes.outputBottom],
                inputs: {
                    ipc: plugin.ipc,
                    session: this._sessionId
                }
            });
        });
        return injections;
    }

    private _sidebar_update() {
        if (this._sidebarTabsService !== undefined) {
            // Drop previous if was defined
            this._sidebarTabsService.clear();
        }
        // Create new tabs service
        this._sidebarTabsService = new TabsService();
        // Detect tabs related to transports (plugins)
        this._transports.forEach((pluginName: string, index: number) => {
            const plugin: IPluginData | undefined = PluginsService.getPlugin(pluginName);
            if (plugin === undefined) {
                this._logger.warn(`Plugin "${pluginName}" is defined as transport, but doesn't exist in storage.`);
                return;
            }
            if (plugin.factories[Toolkit.EViewsTypes.sidebarVertical] === undefined) {
                return;
            }
            // Add tab to sidebar
            this._sidebarTabsService.add({
                guid: Toolkit.guid(),
                name: plugin.name,
                active: index === 0,
                content: {
                    factory: plugin.factories[Toolkit.EViewsTypes.sidebarVertical],
                    resolved: true,
                    inputs: {
                        session: this._sessionId,
                        ipc: plugin.ipc
                    }
                }
            });
        });
    }

}
