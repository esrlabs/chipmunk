import { Base } from './action';
import { bridge } from '@service/bridge';
import { opener } from '@service/opener';

export const ACTION_UUID = 'open_dlt_file';

export class Action extends Base {
    public group(): number {
        return 0;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Open DLT File';
    }

    public async apply(): Promise<void> {
        const files = await bridge.files().select.dlt();
        if (files.length !== 1) {
            return Promise.resolve();
        }
        return opener.file(files[0]).dlt();
    }
}
