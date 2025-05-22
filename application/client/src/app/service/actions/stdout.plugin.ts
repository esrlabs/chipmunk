import { Base } from './action';
import { session } from '@service/session';

import * as Factory from '@platform/types/observe/factory';
import { SessionSourceOrigin } from '@service/session/origin';

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
        session.initialize().configure(SessionSourceOrigin.source());
        return Promise.resolve();
    }
}
