import { Base } from './action';
import { session } from '@service/session';

import * as Factory from '@platform/types/observe/factory';

export const ACTION_UUID = 'stream_text_on_plugin';

export class Action extends Base {
    public override group(): number {
        return 3;
    }

    public override uuid(): string {
        return ACTION_UUID;
    }
    public override caption(): string {
        //TODO AAZ: Name extended for now only.
        return 'Execute command with plugins';
    }
    public override apply(): Promise<void> {
        session.initialize().configure(new Factory.Stream().process().asPlugin().get());
        return Promise.resolve();
    }
}
