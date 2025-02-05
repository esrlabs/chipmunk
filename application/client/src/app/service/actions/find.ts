import { Base } from './action';
import { session } from '@service/session';

export const ACTION_UUID = 'open_find_in_search_dialog';

export class Action extends Base {
    public group(): number {
        return 4;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'FindInSearch';
    }

    public async apply(): Promise<void> {
        const active = session.active().session();
        if (active === undefined) {
            return;
        }
        active.search.state().nested().toggle();
    }
}
