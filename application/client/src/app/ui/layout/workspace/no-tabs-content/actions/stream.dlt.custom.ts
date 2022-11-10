import { Base } from './action';
import { opener } from '@service/opener';

export const ACTION_UUID = 'stream_dlt_on_custom';

export class Action extends Base {
    public group(): number {
        return 2;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Read DLT on Custom Source';
    }

    public async apply(): Promise<void> {
        return opener.stream().dlt() as unknown as Promise<void>;
    }
}
