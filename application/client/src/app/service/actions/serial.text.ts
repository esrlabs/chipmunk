import { Base } from './action';
import { opener } from '@service/opener';
import { Source } from '@platform/types/transport';

export const ACTION_UUID = 'stream_text_on_serial';

export class Action extends Base {
    public group(): number {
        return 3;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Read from Serial Port';
    }

    public async apply(): Promise<void> {
        return opener
            .stream(undefined, undefined, Source.Serial)
            .text()
            .then(() => {
                return Promise.resolve();
            });
    }
}
