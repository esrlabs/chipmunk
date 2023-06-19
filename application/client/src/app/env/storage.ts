import { Destroy } from '@platform/types/env/types';

export class Storage {
    private _entities: Map<string, Destroy> = new Map();

    public destroy() {
        this._entities.forEach((entity: Destroy) => {
            entity.destroy();
        });
    }

    public set(uuid: string, entity: Destroy) {
        this._entities.set(uuid, entity);
    }

    public get<T>(uuid: string): T | undefined {
        const entity = this._entities.get(uuid);
        if (entity === undefined) {
            return undefined;
        } else {
            return entity as unknown as T;
        }
    }
}
