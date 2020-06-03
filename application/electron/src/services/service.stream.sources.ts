import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from '../services/service.electron';
import Logger from '../tools/env.logger';
import { IService } from '../interfaces/interface.service';

export type TSourceId = number;
export interface ISource {
    name: string;
    session: string;
    meta?: string;
}

export class ServiceStreamSources implements IService  {

    private _logger: Logger = new Logger('ServiceStreamSources');
    private _seq: number = 1000; // Started from 1000, because from 0 is reserved for plugins IDs
    private _sources: Map<TSourceId, ISource> = new Map();

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceStreamSources';
    }

    public add(source: ISource): TSourceId {
        const id: TSourceId = this._seq ++;
        this._sources.set(id, source);
        // Notify render about new source
        this._notify(id, source);
        return id;
    }

    public get(id: TSourceId): ISource | undefined {
        return this._sources.get(id);
    }

    public set(id: number, desc: ISource): Error | undefined {
        if (this._sources.has(id)) {
            return new Error(this._logger.warn(`Source id "${id}" is already registred.`));
        }
        this._sources.set(id, desc);
        // Notify render about new source
        this._notify(id, desc);
    }

    public getIdByName(session: string, name: string): number | undefined {
        let id: number | undefined;
        this._sources.forEach((source: ISource, key: number) => {
            if (id !== undefined) {
                return;
            }
            if (source.session !== session) {
                return;
            }
            if (source.name !== name) {
                return;
            }
            id = key;
        });
        return id;
    }

    private _notify(id: number, source: ISource) {
        // Notify render about new source
        ServiceElectron.IPC.send(new IPCElectronMessages.StreamSourceNew({
            id: id,
            name: source.name,
            session: source.session,
            meta: source.meta,
        })).catch((error: Error) => {
            this._logger.warn(`Fail to notify render about new source ("${name}") due error: ${error.message}`);
        });
    }

}

export default (new ServiceStreamSources());
