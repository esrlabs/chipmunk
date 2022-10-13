import { Base } from './action';
import { opener } from '@service/opener';

export const ACTION_UUID = 'stream_text_on_custom';

export class Action extends Base {
    public group(): number {
        return 2;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Read Plaintext on Custom Source';
    }

    public async apply(): Promise<void> {
        return opener.stream().text();
    }
}
