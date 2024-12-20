import { Base } from './action';
import { session } from '@service/session';
import { PluginsManager } from '@tabs/plugins/component';

export const ACTION_UUID = 'open_plugins_manager_tab';

export class Action extends Base {
    override uuid(): string {
        return ACTION_UUID;
    }
    override caption(): string {
        return 'Plugins Manager';
    }
    override group(): number {
        return 0;
    }

    override apply(): Promise<void> {
        session.add().tab({
            name: 'Plugins Manager',
            active: true,
            closable: true,
            content: {
                factory: PluginsManager,
                inputs: {},
            },
            uuid: this.uuid(),
        });
        return Promise.resolve();
    }
}
