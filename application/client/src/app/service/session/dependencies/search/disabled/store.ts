import { Key, Store } from '../store';
import { DisabledRequest } from './request';
import { DisableConvertable } from './converting';
import { EntryConvertable, Recognizable } from '@platform/types/storage/entry';

export { DisabledRequest } from './request';

export class DisableStore extends Store<DisabledRequest> {
    public key(): Key {
        return Key.filters;
    }

    public addFromEntity(entities: Array<Recognizable & DisableConvertable & EntryConvertable>) {
        return this.update(entities.map((en) => new DisabledRequest(en)));
    }
}
