import { Base } from './action';
import { session } from '@service/session';
import { Settings } from '@tabs/settings/component';

export const ACTION_UUID = 'open_settings_tab';

export class Action extends Base {
    public group(): number {
        return 0;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Settings';
    }

    public async apply(): Promise<void> {
        session.add().tab({
            name: 'Settings',
            active: true,
            closable: true,
            content: {
                factory: Settings,
                inputs: {},
            },
            uuid: this.uuid(),
        });
        return Promise.resolve();
    }
}
