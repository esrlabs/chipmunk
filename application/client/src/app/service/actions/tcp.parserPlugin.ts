import { Base } from './action';
import { session } from '@service/session';

import * as Factory from '@platform/types/observe/factory';
import { SessionSourceOrigin } from '@service/session/origin';

export const ACTION_UUID = 'stream_parser_plugin_on_tcp';

export class Action extends Base {
    public group(): number {
        return 3;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Parser plugin on TCP';
    }

    public async apply(): Promise<void> {
        session.initialize().configure(SessionSourceOrigin.source());
        return Promise.resolve();
    }
}
