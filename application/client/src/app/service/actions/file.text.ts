import { Base } from './action';
import { bridge } from '@service/bridge';
import { session } from '@service/session';
import { TabSourceMultipleFiles } from '@ui/tabs/multiplefiles/component';

import * as Factory from '@platform/types/observe/factory';

export const ACTION_UUID = 'open_text_file';

export class Action extends Base {
    public group(): number {
        return 0;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Open Text File';
    }

    public async apply(): Promise<void> {
        const files = await bridge.files().select.text();
        if (files.length === 0) {
            return Promise.resolve();
        }
        if (files.length > 1) {
            session.add().tab({
                name: 'Multiple Files',
                active: true,
                closable: true,
                content: {
                    factory: TabSourceMultipleFiles,
                    inputs: { files: files },
                },
            });
        } else {
            session.initialize().observe(new Factory.File().type(files[0].type).file(files[0].filename).asText().get());
        }
        return Promise.resolve();
    }
}
