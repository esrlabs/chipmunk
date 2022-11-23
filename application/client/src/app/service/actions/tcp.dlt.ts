import { Base } from './action';
import { opener } from '@service/opener';
import { Source } from '@platform/types/transport';

export const ACTION_UUID = 'stream_dlt_on_tcp';

export class Action extends Base {
    public group(): number {
        return 3;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'DLT on TCP';
    }

    public async apply(): Promise<void> {
        return opener
            .stream(undefined, undefined, Source.Tcp)
            .dlt()
            .then(() => {
                return Promise.resolve();
            });
    }
}
