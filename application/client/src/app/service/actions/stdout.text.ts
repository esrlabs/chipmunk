import { Base } from './action';
import { session } from '@service/session';

import { SessionOrigin } from '@service/session/origin';

export const ACTION_UUID = 'stream_text_on_stdout';

export class Action extends Base {
    public group(): number {
        return 3;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Execute command';
    }

    public async apply(): Promise<void> {
        session.initialize().configure(SessionOrigin.source());
        return Promise.resolve();
    }
}
