import { Base } from './action';
import { session } from '@service/session';

import { SessionOrigin } from '@service/session/origin';

export const ACTION_UUID = 'stream_text_on_plugin';

export class Action extends Base {
    public override group(): number {
        return 3;
    }

    public override uuid(): string {
        return ACTION_UUID;
    }
    public override caption(): string {
        return 'Execute command with plugins';
    }
    public override apply(): Promise<void> {
        session.initialize().configure(SessionOrigin.source());
        return Promise.resolve();
    }
}
