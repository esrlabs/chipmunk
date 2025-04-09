import { Base } from './action';
import { styles } from '@ui/service/styles';

export const ACTION_UUID = 'switch_to_dark_theme';

export class Action extends Base {
    public group(): number {
        return 4;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Dark Theme';
    }

    public async apply(): Promise<void> {
        styles.theme().dark();
    }
}
