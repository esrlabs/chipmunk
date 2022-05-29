import { Key, Store } from '../store';
import { DisabledRequest } from './request';

export { DisabledRequest } from './request';

export class DisableStore extends Store<DisabledRequest> {
    public key(): Key {
        return Key.filters;
    }
}
