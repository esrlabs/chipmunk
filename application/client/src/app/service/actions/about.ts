import { Base } from './action';
import { popup, Vertical, Horizontal } from '@ui/service/popup';
import { components } from '@env/decorators/initial';

export const ACTION_UUID = 'open_about_dialog';

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
        popup.open({
            component: {
                factory: components.get('app-dialogs-about'),
                inputs: {},
            },
            position: {
                vertical: Vertical.center,
                horizontal: Horizontal.center,
            },
            closeOnKey: '*',
            uuid: 'About',
        });
    }
}
