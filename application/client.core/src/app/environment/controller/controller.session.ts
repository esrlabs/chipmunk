import PluginsService, { IPluginData } from '../services/service.plugins';
import { Subscription } from '../services/service.electron.ipc';
import { ControllerSessionStream } from './controller.session.stream';
import * as Toolkit from 'logviewer.client.toolkit';

export interface IControllerSession {
    guid: string;
    transports: string[];
}

export interface IComponentInjection {
    factory: any;
    inputs: { [key: string]: any };
}

export class ControllerSession {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _transports: string[];
    private _stream: ControllerSessionStream;

    private _subscriptions: { [key: string]: Subscription | undefined } = {
    };

    constructor(params: IControllerSession) {
        this._guid = params.guid;
        this._transports = params.transports;
        this._logger = new Toolkit.Logger(`ControllerSession: ${params.guid}`);
        this._stream = new ControllerSessionStream({
            guid: params.guid,
            transports: params.transports.slice()
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

    public getSessionStream(): ControllerSessionStream {
        return this._stream;
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
