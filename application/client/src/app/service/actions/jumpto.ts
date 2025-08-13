import { Base } from './action';
import { popup, Vertical, Horizontal } from '@ui/service/popup';
import { components } from '@env/decorators/initial';
import { session } from '@service/session';

export const ACTION_UUID = 'open_jumpto_dialog';

export class Action extends Base {
    public group(): number {
        return 4;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'JumpTo';
    }

    public async apply(): Promise<void> {
        if (session.active().session() === undefined) {
            return;
        }
        popup.open({
            component: {
                factory: components.get('app-dialogs-jumpto'),
                inputs: {},
            },
            position: {
                vertical: Vertical.top,
                horizontal: Horizontal.center,
            },
            closeOnKey: 'Escape',
            size: { width: 350 },
            uuid: 'Ctrl + G',
            blur: false,
        });
    }
}
