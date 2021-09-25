import * as Toolkit from 'chipmunk.client.toolkit';
import ElectronIpcService, { IPC, Subscription } from './service.electron.ipc';
import PluginsService, { IPluginData } from './service.plugins';
import { IService } from '../interfaces/interface.service';

export type TSourceId = number;

export interface ISource {
    name: string;
    color: string;
    shadow: string;
    pluginId: number | undefined;
    session: string;
    meta?: string;
}

export class SourcesService implements IService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('SourcesService');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _sources: Map<TSourceId, ISource> = new Map();
    private _counts: Map<string, number> = new Map();

    constructor() {
        this._ipc_onStreamSourceNew = this._ipc_onStreamSourceNew.bind(this);
        this._subscriptions.StreamSourceNew = ElectronIpcService.subscribe(
            IPC.StreamSourceNew,
            this._ipc_onStreamSourceNew,
        );
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

    public getSourceMeta(id: TSourceId): string | undefined {
        const data = this._sources.get(id);
        if (data === undefined) {
            return undefined;
        }
        return data.meta;
    }

    public getSourceColor(id: TSourceId): string | undefined {
        const data = this._sources.get(id);
        if (data === undefined) {
            return undefined;
        }
        return data.color;
    }

    public getSourceShadowColor(id: TSourceId): string | undefined {
        const data = this._sources.get(id);
        if (data === undefined) {
            return undefined;
        }
        return data.shadow;
    }

    public getRelatedPlugin(id: TSourceId): IPluginData | undefined {
        const data = this._sources.get(id);
        if (data === undefined) {
            return undefined;
        }
        return PluginsService.getPluginById(id);
    }

    public getCountOfSource(session: string): number {
        const count: number | undefined = this._counts.get(session);
        return count === undefined ? 0 : count;
    }

    private _setCountOfSource() {
        this._counts.clear();
        this._sources.forEach((source: ISource) => {
            const count: number | undefined = this._counts.get(source.session);
            if (count === undefined) {
                this._counts.set(source.session, 1);
            } else {
                this._counts.set(source.session, (this._counts.get(source.session) as number) + 1);
            }
        });
    }

    private _ipc_onStreamSourceNew(message: IPC.StreamSourceNew) {
        if (this._sources.has(message.id)) {
            return;
        }
        const r: number = Math.round(Math.random() * 154) + 100;
        const g: number = Math.round(Math.random() * 154) + 100;
        const b: number = Math.round(Math.random() * 154) + 100;
        this._sources.set(message.id, {
            name: message.name,
            color: `rgb(${r},${g},${b})`,
            shadow: `rgba(${r},${g},${b}, 0.15)`,
            pluginId: undefined,
            session: message.session,
            meta: message.meta,
        });
        this._setCountOfSource();
    }
}

export default new SourcesService();
