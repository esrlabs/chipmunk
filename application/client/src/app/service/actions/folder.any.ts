import { Base } from './action';
import { bridge } from '@service/bridge';
import { session } from '@service/session';
import { TabSourceMultipleFiles } from '@ui/tabs/multiplefiles/component';
import { FileType } from '@platform/types/files';
import { notifications, Notification } from '@ui/service/notifications';

import * as Factory from '@platform/types/observe/factory';

export const ACTION_UUID = 'open_any_folder';

export class Action extends Base {
    public group(): number {
        return 1;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Open Folder(s)';
    }

    public async apply(): Promise<void> {
        const files = await bridge.folders().any();
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
        } else {
            switch (files[0].type) {
                case FileType.Dlt:
                    session
                        .initialize()
                        .configure(new Factory.File().file(files[0].filename).asDlt().observe);
                    break;
                case FileType.PcapNG:
                    session
                        .initialize()
                        .suggest(new Factory.File().file(files[0].filename).observe);
                    break;
                default:
                    session
                        .initialize()
                        .observe(new Factory.File().file(files[0].filename).asText().observe);
                    break;
            }
        }
        return Promise.resolve();
    }
}
