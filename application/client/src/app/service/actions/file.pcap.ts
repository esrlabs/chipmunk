import { Base } from './action';
import { bridge } from '@service/bridge';
import { session } from '@service/session';
import { TabSourceMultipleFiles } from '@ui/tabs/multiplefiles/component';

import { SessionOrigin } from '@service/session/origin';

export const ACTION_UUID = 'open_pcap_legacy_file';

export class Action extends Base {
    public group(): number {
        return 0;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Open Pcap File';
    }

    public async apply(): Promise<void> {
        const files = await bridge.files().select.pcap();
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
            session.initialize().configure(SessionOrigin.file(files[0].filename));
        }
        return Promise.resolve();
    }
}
