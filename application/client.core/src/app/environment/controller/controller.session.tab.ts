import PluginsService, { IPluginData } from '../services/service.plugins';
import { Subscription } from '../services/service.electron.ipc';
import { ControllerSessionTabStream } from './controller.session.tab.stream';
import { ControllerSessionTabSearch } from './controller.session.tab.search';
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
    private _guid: string;
    private _transports: string[];
    private _stream: ControllerSessionTabStream;
    private _search: ControllerSessionTabSearch;

    private _subscriptions: { [key: string]: Subscription | undefined } = {
    };

    constructor(params: IControllerSession) {
        this._guid = params.guid;
        this._transports = params.transports;
        this._logger = new Toolkit.Logger(`ControllerSession: ${params.guid}`);
        this._stream = new ControllerSessionTabStream({
            guid: params.guid,
            transports: params.transports.slice()
        });
        this._search = new ControllerSessionTabSearch({
            guid: params.guid
        });
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public getGuid(): string {
        return this._guid;
    }

    public getSessionStream(): ControllerSessionTabStream {
        return this._stream;
    }

    public getSessionSearch(): ControllerSessionTabSearch {
        return this._search;
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
                    session: this._guid
                }
            });
        });
        return injections;
    }

}
