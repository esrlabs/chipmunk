import * as Toolkit from 'logviewer.client.toolkit';
import ElectronIpcService, { IPCMessages, Subscription } from './service.electron.ipc';
import PluginsService, { IPluginData } from './service.plugins';
import { IService } from '../interfaces/interface.service';

export type TSourceId = number;
export interface ISource {
    name: string;
    color: string;
    pluginId: number | undefined;
}

export class SourcesService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('SourcesService');
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _sources: Map<TSourceId, ISource> = new Map();

    constructor() {
        this._ipc_onStreamSourceNew = this._ipc_onStreamSourceNew.bind(this);
        this._subscriptions.StreamSourceNew = ElectronIpcService.subscribe(IPCMessages.StreamSourceNew, this._ipc_onStreamSourceNew);
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'SourcesService';
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public getSourceName(id: TSourceId): string | undefined {
        const data = this._sources.get(id);
        if (data === undefined) {
            return undefined;
        }
        return data.name;
    }

    public getSourceColor(id: TSourceId): string | undefined {
        const data = this._sources.get(id);
        if (data === undefined) {
            return undefined;
        }
        return data.color;
    }

    public getRelatedPlugin(id: TSourceId): IPluginData | undefined {
        const data = this._sources.get(id);
        if (data === undefined) {
            return undefined;
        }
        return PluginsService.getPluginById(id);
    }

    private _ipc_onStreamSourceNew(message: IPCMessages.StreamSourceNew) {
        if (this._sources.has(message.id)) {
            return;
        }
        this._sources.set(message.id, {
            name: message.name,
            color: `rgb(${Math.round(Math.random() * 154) + 100},${Math.round(Math.random() * 154) + 100},${Math.round(Math.random() * 154) + 100})`,
            pluginId: undefined
        });
    }


}

export default (new SourcesService());
