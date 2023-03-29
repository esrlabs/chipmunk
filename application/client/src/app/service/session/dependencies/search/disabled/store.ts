import { Key, Store, StoredEntity } from '../store';
import { DisabledRequest } from './request';
import { DisableConvertable } from './converting';

export { DisabledRequest } from './request';

export class DisableStore extends Store<DisabledRequest> {
    public key(): Key {
        return Key.filters;
    }

    public addFromEntity(entities: DisableConvertable[]) {
        return this.update(
            entities.map((en) => new DisabledRequest(en) as StoredEntity<DisabledRequest>),
        );
    }

    public has(request: DisabledRequest): boolean {
        return this.get().find((entity) => entity.isSame(request)) !== undefined;
    }
}
