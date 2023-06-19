import { Base } from './action';
import { session } from '@service/session';

import * as Factory from '@platform/types/observe/factory';

export const ACTION_UUID = 'stream_dlt_on_custom';

export class Action extends Base {
    public group(): number {
        return 2;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'DLT on Custom Source';
    }

    public async apply(): Promise<void> {
        session.initialize().configure(new Factory.Stream().asDlt().observe);
        return Promise.resolve();
    }
}
