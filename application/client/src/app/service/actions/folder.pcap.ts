import { Base } from './action';
import { bridge } from '@service/bridge';
import { opener } from '@service/opener';
import { session } from '@service/session';
import { TabSourceMultipleFiles } from '@tabs/sources/multiplefiles/component';

import { notifications, Notification } from '@ui/service/notifications';

export const ACTION_UUID = 'open_pcap_folder';

export class Action extends Base {
    public group(): number {
        return 0;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Select Folder with PCAP';
    }

    public async apply(): Promise<void> {
        const files = await bridge.folders().pcap();
        if (files.length === 0) {
            notifications.notify(
                new Notification({
                    message: 'No files has been found',
                    actions: [],
                }),
            );
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
            return Promise.resolve();
        }
        return opener
            .pcap(files[0])
            .dlt()
            .then(() => {
                return Promise.resolve();
            });
    }
}
