import { Base } from './action';
import { session } from '@service/session';

import * as Factory from '@platform/types/observe/factory';
import { SessionOrigin } from '@service/session/origin';

export const ACTION_UUID = 'stream_dlt_on_udp';

export class Action extends Base {
    public group(): number {
        return 3;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'DLT on UDP';
    }

    public async apply(): Promise<void> {
        session.initialize().configure(SessionOrigin.source());
        return Promise.resolve();
    }
}
