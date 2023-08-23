import { Base } from './action';
import { session } from '@service/session';
import { Help } from '@tabs/help/component';

export const ACTION_UUID = 'open_help_tab';

export class Action extends Base {
    public group(): number {
        return 4;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'About';
    }

    public async apply(): Promise<void> {
        session.add().tab({
            name: 'Documentation',
            active: true,
            closable: true,
            content: {
                factory: Help,
                inputs: {},
            },
            uuid: this.uuid(),
        });
        return Promise.resolve();
    }
}
